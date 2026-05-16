import { NextRequest, NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'
import { checkAuth } from '@/lib/middleware'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

const BLOB_TOKEN = process.env.phototoast_READ_WRITE_TOKEN

interface BlobEntry {
  url: string
  pathname: string
  size: number
  sizeMB: number
  uploadedAt: string
  orphaned?: boolean
}

interface StorageStats {
  totalBytes: number
  totalSizeMB: number
  blobCount: number
  maxSizeMB: number
  usagePercent: number
  byExtension: Record<string, { count: number; sizeMB: number }>
  configured: boolean
  error?: string
}

async function getStorageStats(): Promise<StorageStats> {
  const maxSizeMB = parseInt(process.env.VERCEL_BLOB_MAX_STORAGE_MB || '500', 10)

  if (!BLOB_TOKEN) {
    return {
      totalBytes: 0,
      totalSizeMB: 0,
      blobCount: 0,
      maxSizeMB,
      usagePercent: 0,
      byExtension: {},
      configured: false,
      error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다',
    }
  }

  try {
    let cursor: string | undefined
    let totalBytes = 0
    let blobCount = 0
    const extMap = new Map<string, { count: number; bytes: number }>()

    do {
      const result = await list({ token: BLOB_TOKEN, cursor, limit: 1000 })
      for (const blob of result.blobs) {
        totalBytes += blob.size
        blobCount++
        const ext = blob.pathname.includes('.')
          ? blob.pathname.split('.').pop()!.toLowerCase()
          : 'unknown'
        const existing = extMap.get(ext) || { count: 0, bytes: 0 }
        existing.count++
        existing.bytes += blob.size
        extMap.set(ext, existing)
      }
      cursor = result.cursor
    } while (cursor)

    const totalSizeMB = roundMB(totalBytes)
    const usagePercent = maxSizeMB > 0 ? Math.round((totalSizeMB / maxSizeMB) * 1000) / 10 : 0

    const byExtension: Record<string, { count: number; sizeMB: number }> = {}
    for (const [ext, info] of Array.from(extMap.entries())) {
      byExtension[ext] = { count: info.count, sizeMB: roundMB(info.bytes) }
    }

    return { totalBytes, totalSizeMB, blobCount, maxSizeMB, usagePercent, byExtension, configured: true }
  } catch (error) {
    console.error('[storage] Failed to fetch Blob stats:', error)
    return {
      totalBytes: 0, totalSizeMB: 0, blobCount: 0, maxSizeMB,
      usagePercent: 0, byExtension: {}, configured: true,
      error: error instanceof Error ? error.message : 'Blob 통계를 불러오는데 실패했습니다',
    }
  }
}

/** Fetch all blob URLs referenced in printJobs (imageUrl + printedImageUrl) */
async function getReferencedBlobUrls(): Promise<Set<string>> {
  try {
    const db = await getDb()
    const printJobs = await db.collection(COLLECTIONS.printJobs).find(
      {},
      { projection: { imageUrl: 1, printedImageUrl: 1, _id: 0 } }
    ).toArray()

    const urls = new Set<string>()
    for (const job of printJobs) {
      if (job.imageUrl) urls.add(job.imageUrl)
      if (job.printedImageUrl) urls.add(job.printedImageUrl)
    }
    return urls
  } catch {
    return new Set()
  }
}

/** List all blobs with pagination and orphan detection */
async function listBlobs(cursor?: string): Promise<{ blobs: BlobEntry[]; nextCursor?: string }> {
  if (!BLOB_TOKEN) return { blobs: [] }

  const result = await list({ token: BLOB_TOKEN, cursor, limit: 200 })
  const referencedUrls = await getReferencedBlobUrls()

  const blobs: BlobEntry[] = result.blobs.map(b => ({
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    sizeMB: roundMB(b.size),
    uploadedAt: b.uploadedAt.toISOString(),
    orphaned: !referencedUrls.has(b.url),
  }))

  return { blobs, nextCursor: result.cursor }
}

function roundMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

// ─── GET: Stats + paginated blob list ───────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'stats'
    const cursor = searchParams.get('cursor') || undefined

    if (mode === 'list') {
      const result = await listBlobs(cursor)
      return NextResponse.json(result)
    }

    // Default: stats
    const stats = await getStorageStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[storage] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch storage data' }, { status: 500 })
  }
}

// ─── DELETE: Remove specific blobs ──────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!BLOB_TOKEN) {
      return NextResponse.json({ error: 'Blob storage not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { urls, mode } = body

    // Mode: delete orphaned blobs
    if (mode === 'orphans') {
      const referencedUrls = await getReferencedBlobUrls()
      let cursor: string | undefined
      const orphanUrls: string[] = []

      do {
        const result = await list({ token: BLOB_TOKEN, cursor, limit: 1000 })
        for (const blob of result.blobs) {
          if (!referencedUrls.has(blob.url)) {
            orphanUrls.push(blob.url)
          }
        }
        cursor = result.cursor
      } while (cursor)

      if (orphanUrls.length === 0) {
        return NextResponse.json({ deleted: 0, message: '고아 파일이 없습니다' })
      }

      // Delete in batches of 100 (Vercel Blob limit per request)
      let deletedCount = 0
      for (let i = 0; i < orphanUrls.length; i += 100) {
        const batch = orphanUrls.slice(i, i + 100)
        await del(batch, { token: BLOB_TOKEN })
        deletedCount += batch.length
      }

      return NextResponse.json({
        deleted: deletedCount,
        message: `${deletedCount}개의 고아 파일을 삭제했습니다`,
      })
    }

    // Delete specific URLs
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: '삭제할 URL 목록이 필요합니다' }, { status: 400 })
    }

    // Delete in batches of 100
    let deletedCount = 0
    for (let i = 0; i < urls.length; i += 100) {
      const batch = urls.slice(i, i + 100)
      await del(batch, { token: BLOB_TOKEN })
      deletedCount += batch.length
    }

    return NextResponse.json({ deleted: deletedCount })
  } catch (error) {
    console.error('[storage] DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '삭제 실패' },
      { status: 500 }
    )
  }
}

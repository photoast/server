import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { checkAuth } from '@/lib/middleware'

interface BlobStoreStat {
  /** Total bytes used across all blobs */
  totalBytes: number
  /** Total size in MB (rounded to 2 decimal places) */
  totalSizeMB: number
  /** Total number of stored blobs */
  blobCount: number
  /** Maximum allowed storage in MB (Vercel Blob Hobby free tier: 500MB) */
  maxSizeMB: number
  /** Usage as percentage */
  usagePercent: number
  /** Blobs grouped by file extension */
  byExtension: Record<string, { count: number; sizeMB: number }>
  /** Whether the token was available */
  configured: boolean
  /** Error message if any */
  error?: string
}

async function fetchBlobStats(): Promise<BlobStoreStat> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const maxSizeMB = parseInt(process.env.VERCEL_BLOB_MAX_STORAGE_MB || '500', 10)

  if (!token) {
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

    // Paginate through all blobs
    do {
      const result = await list({
        token,
        cursor,
        limit: 1000,
      })

      for (const blob of result.blobs) {
        totalBytes += blob.size
        blobCount++

        // Derive extension from pathname
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

    // Build byExtension summary
    const byExtension: Record<string, { count: number; sizeMB: number }> = {}
    for (const [ext, info] of Array.from(extMap.entries())) {
      byExtension[ext] = {
        count: info.count,
        sizeMB: roundMB(info.bytes),
      }
    }

    return {
      totalBytes,
      totalSizeMB,
      blobCount,
      maxSizeMB,
      usagePercent,
      byExtension,
      configured: true,
    }
  } catch (error) {
    console.error('[storage-stats] Failed to fetch Blob stats:', error)
    return {
      totalBytes: 0,
      totalSizeMB: 0,
      blobCount: 0,
      maxSizeMB,
      usagePercent: 0,
      byExtension: {},
      configured: true,
      error: error instanceof Error ? error.message : 'Blob 통계를 불러오는데 실패했습니다',
    }
  }
}

function roundMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await fetchBlobStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[storage-stats] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch storage statistics' },
      { status: 500 }
    )
  }
}

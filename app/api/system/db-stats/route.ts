import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/middleware'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

interface CollectionStat {
  name: string
  sizeMB: number
  count: number
  avgObjSizeBytes: number
  storageSizeMB: number
  indexSizeMB: number
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()

    // Get overall database stats
    const dbStats = await db.command({ dbStats: 1 }) as {
      dataSize: number
      storageSize: number
      indexSize: number
      totalSize: number
      collections: number
      objects: number
      fsTotalSize?: number
      fsUsedSize?: number
    }

    // Get per-collection stats
    const collectionNames = Object.values(COLLECTIONS)
    const collectionStats: CollectionStat[] = []

    for (const name of collectionNames) {
      try {
        const stats = await db.command({ collStats: name }) as {
          count: number
          size: number
          storageSize: number
          totalIndexSize: number
          avgObjSize: number
        }
        collectionStats.push({
          name,
          sizeMB: roundMB(stats.size),
          count: stats.count,
          avgObjSizeBytes: stats.avgObjSize || 0,
          storageSizeMB: roundMB(stats.storageSize),
          indexSizeMB: roundMB(stats.totalIndexSize),
        })
      } catch {
        // Collection might not exist yet
        collectionStats.push({
          name,
          sizeMB: 0,
          count: 0,
          avgObjSizeBytes: 0,
          storageSizeMB: 0,
          indexSizeMB: 0,
        })
      }
    }

    // Sort by storage size descending
    collectionStats.sort((a, b) => (b.storageSizeMB + b.indexSizeMB) - (a.storageSizeMB + a.indexSizeMB))

    // Max storage from env, default 512MB (MongoDB Atlas M0 free tier)
    const maxSizeMB = parseInt(process.env.MONGODB_MAX_STORAGE_MB || '512', 10)

    // totalSize may not be available on all MongoDB deployments (e.g. Atlas M0)
    // Fall back to storageSize + indexSize
    const totalBytes = dbStats.totalSize ?? ((dbStats.storageSize + dbStats.indexSize) || 0)
    const totalUsedMB = roundMB(totalBytes)
    const usagePercent = maxSizeMB > 0 ? Math.round((totalUsedMB / maxSizeMB) * 1000) / 10 : 0

    return NextResponse.json({
      // Overall stats
      totalSizeMB: totalUsedMB,
      dataSizeMB: roundMB(dbStats.dataSize),
      storageSizeMB: roundMB(dbStats.storageSize),
      indexSizeMB: roundMB(dbStats.indexSize),
      collectionCount: dbStats.collections,
      objectCount: dbStats.objects,
      // Capacity
      maxSizeMB,
      usagePercent,
      // Filesystem (only available on certain deployments)
      fsTotalSizeMB: dbStats.fsTotalSize ? roundMB(dbStats.fsTotalSize) : null,
      fsUsedSizeMB: dbStats.fsUsedSize ? roundMB(dbStats.fsUsedSize) : null,
      // Per-collection
      collections: collectionStats,
    })
  } catch (error) {
    console.error('[db-stats] Failed to fetch DB stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch database statistics' },
      { status: 500 }
    )
  }
}

function roundMB(bytes: number | null | undefined): number {
  if (bytes == null || isNaN(bytes as number)) return 0
  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

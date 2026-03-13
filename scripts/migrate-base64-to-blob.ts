/**
 * printJobs 컬렉션에서 base64 data URL을 Vercel Blob URL로 마이그레이션
 *
 * 사용법: npx tsx scripts/migrate-base64-to-blob.ts
 *
 * 필요한 환경변수:
 *   MONGODB_URI — MongoDB 연결 문자열
 *   phototoast_READ_WRITE_TOKEN — Vercel Blob 토큰
 *
 * --dry-run 플래그로 실제 변경 없이 대상 확인 가능:
 *   npx tsx scripts/migrate-base64-to-blob.ts --dry-run
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config() // .env fallback

import { MongoClient } from 'mongodb'
import { put } from '@vercel/blob'

const MONGODB_URI = process.env.MONGODB_URI
const BLOB_TOKEN = process.env.phototoast_READ_WRITE_TOKEN

if (!MONGODB_URI) {
  console.error('MONGODB_URI 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}
if (!BLOB_TOKEN) {
  console.error('phototoast_READ_WRITE_TOKEN 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')

async function uploadBase64ToBlob(base64DataUrl: string, prefix: string): Promise<string> {
  const base64Data = base64DataUrl.split(',')[1]
  const buffer = Buffer.from(base64Data, 'base64')
  const filename = `${prefix}-migrated-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const blob = await put(filename, buffer, {
    access: 'public',
    token: BLOB_TOKEN!,
    contentType: 'image/jpeg',
  })
  return blob.url
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI!)
  await client.connect()
  console.log('[Migration] MongoDB 연결 완료')

  const db = client.db('photoast')
  const collection = db.collection('printJobs')

  // base64 data URL이 포함된 문서 찾기
  const query = {
    $or: [
      { imageUrl: { $regex: '^data:' } },
      { printedImageUrl: { $regex: '^data:' } },
    ],
  }

  const totalCount = await collection.countDocuments(query)
  console.log(`[Migration] base64 데이터가 포함된 printJobs: ${totalCount}건`)

  if (totalCount === 0) {
    console.log('[Migration] 마이그레이션 대상 없음. 종료.')
    await client.close()
    return
  }

  if (DRY_RUN) {
    // 용량 추정
    const docs = await collection.find(query).project({ imageUrl: 1, printedImageUrl: 1 }).toArray()
    let totalBytes = 0
    for (const doc of docs) {
      if (doc.imageUrl?.startsWith('data:')) {
        totalBytes += Buffer.byteLength(doc.imageUrl, 'utf8')
      }
      if (doc.printedImageUrl?.startsWith('data:')) {
        totalBytes += Buffer.byteLength(doc.printedImageUrl, 'utf8')
      }
    }
    console.log(`[Dry Run] 총 base64 데이터 크기: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`)
    console.log('[Dry Run] 실제 마이그레이션하려면 --dry-run 없이 실행하세요.')
    await client.close()
    return
  }

  // 배치 처리
  const cursor = collection.find(query)
  let migrated = 0
  let failed = 0

  for await (const doc of cursor) {
    try {
      const updates: Record<string, string> = {}

      if (doc.imageUrl?.startsWith('data:')) {
        const blobUrl = await uploadBase64ToBlob(doc.imageUrl, 'original')
        updates.imageUrl = blobUrl
      }

      if (doc.printedImageUrl?.startsWith('data:')) {
        const blobUrl = await uploadBase64ToBlob(doc.printedImageUrl, 'printed')
        updates.printedImageUrl = blobUrl
      }

      if (Object.keys(updates).length > 0) {
        await collection.updateOne({ _id: doc._id }, { $set: updates })
        migrated++
        if (migrated % 10 === 0) {
          console.log(`[Migration] 진행: ${migrated}/${totalCount}`)
        }
      }
    } catch (err) {
      failed++
      console.error(`[Migration] 실패 (${doc._id}):`, err)
    }
  }

  console.log(`\n[Migration] 완료!`)
  console.log(`  성공: ${migrated}건`)
  console.log(`  실패: ${failed}건`)

  await client.close()
}

migrate().catch((err) => {
  console.error('[Migration] 치명적 오류:', err)
  process.exit(1)
})

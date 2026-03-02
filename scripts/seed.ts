/**
 * MongoDB Atlas 시드 스크립트
 * 빈 DB일 때만 기본 이벤트 + 레이아웃 템플릿을 생성합니다.
 *
 * 사용법: npx tsx scripts/seed.ts
 */
import { MongoClient } from 'mongodb'
import { DEFAULT_LAYOUT_TEMPLATES } from '../lib/defaultLayoutTemplates'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

async function seed() {
  const client = new MongoClient(MONGODB_URI!)
  await client.connect()
  console.log('[Seed] MongoDB 연결 완료')

  const db = client.db('photoast')

  // 이미 데이터가 있으면 스킵
  const eventCount = await db.collection('events').countDocuments()
  if (eventCount > 0) {
    console.log(`[Seed] 이미 ${eventCount}개의 이벤트가 있습니다. 시드를 건너뜁니다.`)
    await client.close()
    return
  }

  // 인덱스 생성
  await Promise.all([
    db.collection('events').createIndex({ slug: 1 }, { unique: true }),
    db.collection('layouts').createIndex({ eventId: 1 }),
    db.collection('printJobs').createIndex({ eventId: 1 }),
    db.collection('errorLogs').createIndex({ eventSlug: 1 }),
    db.collection('admins').createIndex({ username: 1 }, { unique: true }),
  ])
  console.log('[Seed] 인덱스 생성 완료')

  // 기본 이벤트 생성
  const events = [
    { name: 'Photo Toast', slug: 'phost-default', printMethod: 'email', borderCorrectionEnabled: true },
    { name: 'Photo Toast Socket', slug: 'phost-socket', printMethod: 'socket', borderCorrectionEnabled: true },
  ]

  for (const eventData of events) {
    const result = await db.collection('events').insertOne({
      ...eventData,
      createdAt: new Date(),
    })
    const eventId = result.insertedId.toString()
    console.log(`[Seed] 이벤트 생성: ${eventData.name} (${eventId})`)

    // 레이아웃 템플릿 생성
    for (let idx = 0; idx < DEFAULT_LAYOUT_TEMPLATES.length; idx++) {
      const t = DEFAULT_LAYOUT_TEMPLATES[idx]
      const now = new Date().toISOString()
      await db.collection('layouts').insertOne({
        eventId,
        name: t.name,
        printSize: t.printSize,
        canvasWidth: t.canvasWidth,
        canvasHeight: t.canvasHeight,
        slots: t.slots.map((s, i) => ({ ...s, id: `slot-${i}`, order: i, zIndex: 10 + i, rotation: 0 })),
        frameLayers: t.frameLayers || [],
        frameUrl: null,
        backgroundColor: t.backgroundColor,
        backgroundColorCustomizable: t.backgroundColorCustomizable,
        isPreset: true,
        order: idx,
        createdAt: now,
        updatedAt: now,
      })
    }
    console.log(`[Seed]   └─ ${DEFAULT_LAYOUT_TEMPLATES.length}개 레이아웃 템플릿 생성`)
  }

  console.log('[Seed] 시드 완료!')
  await client.close()
}

seed().catch(err => {
  console.error('[Seed] 에러:', err)
  process.exit(1)
})

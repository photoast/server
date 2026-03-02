/**
 * Migration: 기존 Event의 인쇄 설정을 Printer 엔티티로 분리
 *
 * 실행: npx tsx scripts/migrate-printers.ts
 *
 * 동작:
 * 1. 기존 이벤트의 printMethod/email 조합별로 Printer 생성
 * 2. 각 이벤트에 printerId 설정
 * 3. 이전 필드는 호환성을 위해 유지 ($unset 하지 않음)
 */

import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI 환경변수가 필요합니다')
  process.exit(1)
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI!)
  await client.connect()
  const db = client.db('photoast')

  console.log('[Migration] 프린터 엔티티 분리 시작\n')

  const events = await db.collection('events').find().toArray()
  console.log(`[Migration] 이벤트 ${events.length}개 발견`)

  // 이벤트별 인쇄 설정 조합을 추출하여 프린터 생성
  const printerMap = new Map<string, ObjectId>() // key → printerId

  for (const event of events) {
    // 이미 printerId가 있으면 스킵
    if (event.printerId) {
      console.log(`  - "${event.name}" → 이미 printerId 있음, 스킵`)
      continue
    }

    const printMethod = event.printMethod || 'email'
    const borderCorrectionEnabled = event.borderCorrectionEnabled ?? true
    const shrinkPercent = event.shrinkPercent ?? 97.5
    const verticalOffsetPx = event.verticalOffsetPx ?? 0

    // 프린터 고유 키: 설정값 조합
    const key = `${printMethod}|${borderCorrectionEnabled}|${shrinkPercent}|${verticalOffsetPx}`

    if (!printerMap.has(key)) {
      // 새 프린터 생성
      const printerName = `마이그레이션 프린터 (${printMethod})`
      const result = await db.collection('printers').insertOne({
        name: printerName,
        printMethod,
        email: process.env.PRINTER_EMAIL || undefined,
        borderCorrectionEnabled,
        shrinkPercent,
        verticalOffsetPx,
        createdAt: new Date(),
      })
      printerMap.set(key, result.insertedId)
      console.log(`  [NEW] 프린터 생성: "${printerName}" (${result.insertedId})`)
      console.log(`         설정: shrink=${shrinkPercent}%, offset=${verticalOffsetPx}px, correction=${borderCorrectionEnabled}`)
    }

    const printerId = printerMap.get(key)!.toString()

    // 이벤트에 printerId 추가
    await db.collection('events').updateOne(
      { _id: event._id },
      { $set: { printerId } }
    )
    console.log(`  - "${event.name}" → printerId: ${printerId}`)
  }

  // name 유니크 인덱스 생성
  try {
    await db.collection('printers').createIndex({ name: 1 }, { unique: true })
    console.log('\n[Migration] printers.name 유니크 인덱스 생성 완료')
  } catch (err) {
    console.log('\n[Migration] printers.name 인덱스 이미 존재하거나 생성 실패:', err)
  }

  console.log(`\n[Migration] 완료! 프린터 ${printerMap.size}개 생성, 이벤트 ${events.length}개 처리`)
  console.log('[Migration] 기존 이벤트 필드(printMethod, borderCorrectionEnabled 등)는 호환성을 위해 유지됨')

  await client.close()
}

migrate().catch(err => {
  console.error('[Migration] 오류:', err)
  process.exit(1)
})

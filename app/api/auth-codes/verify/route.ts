import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug } from '@/lib/models'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  const { slug, code } = await request.json()
  if (!slug || !code) {
    return NextResponse.json({ error: 'slug and code are required' }, { status: 400 })
  }

  const event = await findEventBySlug(slug)
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!event.authCodeRequired) {
    return NextResponse.json({ valid: true })
  }

  const db = await getDb()
  const authCode = await db.collection(COLLECTIONS.authCodes).findOne({
    eventId: event._id!.toString(),
    code: code.toUpperCase(),
  })

  if (!authCode) {
    return NextResponse.json({ valid: false, error: '유효하지 않은 인증코드입니다' })
  }
  if (authCode.used) {
    return NextResponse.json({ valid: false, error: '이미 사용된 인증코드입니다' })
  }

  return NextResponse.json({ valid: true })
}

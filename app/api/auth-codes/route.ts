import { NextRequest, NextResponse } from 'next/server'
import { createAuthCodes, getAuthCodesByEventId, deleteAuthCodesByEventId } from '@/lib/models'

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }
  const codes = await getAuthCodesByEventId(eventId)
  return NextResponse.json(codes)
}

export async function POST(request: NextRequest) {
  const { eventId, count } = await request.json()
  if (!eventId || !count || count < 1 || count > 500) {
    return NextResponse.json({ error: 'eventId and count (1-500) are required' }, { status: 400 })
  }
  const codes = await createAuthCodes(eventId, count)
  return NextResponse.json(codes)
}

export async function DELETE(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }
  const deleted = await deleteAuthCodesByEventId(eventId)
  return NextResponse.json({ deleted })
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { deviceId, sessionId, slug, action, params } = await req.json()
    if (!deviceId || !sessionId || !slug || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = await getDb()
    await db.collection(COLLECTIONS.userEvents).insertOne({
      deviceId,
      sessionId,
      slug,
      action,
      params: params || {},
      timestamp: new Date(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    const deviceId = searchParams.get('deviceId')
    const limit = Math.min(Number(searchParams.get('limit') || 200), 500)

    const db = await getDb()
    const filter: any = {}
    if (slug) filter.slug = slug
    if (deviceId) filter.deviceId = deviceId

    const events = await db.collection(COLLECTIONS.userEvents)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    // Group by session
    const sessions = new Map<string, any>()
    for (const ev of events) {
      const sid = ev.sessionId
      if (!sessions.has(sid)) {
        sessions.set(sid, {
          sessionId: sid,
          deviceId: ev.deviceId,
          slug: ev.slug,
          events: [],
          lastActivity: ev.timestamp,
        })
      }
      sessions.get(sid).events.push({
        action: ev.action,
        params: ev.params,
        timestamp: ev.timestamp,
      })
    }

    const result = Array.from(sessions.values())
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

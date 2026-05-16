import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { deviceId, sessionId, slug, action, params } = await req.json()
    if (!deviceId || !sessionId || !slug || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || ''

    const db = await getDb()
    await db.collection(COLLECTIONS.userEvents).insertOne({
      deviceId,
      sessionId,
      slug,
      action,
      params: params || {},
      userAgent,
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
    const mode = searchParams.get('mode')
    const slug = searchParams.get('slug')
    const deviceId = searchParams.get('deviceId')
    const excludeSessions = searchParams.get('excludeSessions')?.split(',').filter(Boolean) || []
    const days = Math.min(Number(searchParams.get('days') || 7), 30)

    const db = await getDb()

    if (mode === 'stats') {
      const granularity = Math.max(1, Math.min(1440, Number(searchParams.get('granularity') || 60)))
      const since = new Date()
      since.setDate(since.getDate() - days)

      const filter: any = { timestamp: { $gte: since } }
      if (slug) filter.slug = slug
      if (excludeSessions.length > 0) filter.sessionId = { $nin: excludeSessions }

      const events = await db.collection(COLLECTIONS.userEvents)
        .find(filter)
        .sort({ timestamp: 1 })
        .toArray()

      const toBucketKey = (d: Date) => {
        const mins = d.getHours() * 60 + d.getMinutes()
        const bucketMins = Math.floor(mins / granularity) * granularity
        const hh = String(Math.floor(bucketMins / 60)).padStart(2, '0')
        const mm = String(bucketMins % 60).padStart(2, '0')
        return `${d.toISOString().slice(0, 10)} ${hh}:${mm}`
      }

      const sessionBuckets = new Map<string, Set<string>>()
      const photoSlotBuckets = new Map<string, Set<string>>()
      const purchaseBuckets = new Map<string, Set<string>>()
      const revenue = new Map<string, number>()
      const uniqueSessions = new Set<string>()
      const uniquePhotoSlots = new Set<string>()
      const uniquePurchases = new Set<string>()

      for (const ev of events) {
        const key = toBucketKey(new Date(ev.timestamp))
        if (ev.action === 'page_enter') {
          if (!sessionBuckets.has(key)) sessionBuckets.set(key, new Set())
          sessionBuckets.get(key)!.add(ev.sessionId)
          uniqueSessions.add(ev.sessionId)
        }
        if (ev.action === 'crop_open') {
          if (!photoSlotBuckets.has(key)) photoSlotBuckets.set(key, new Set())
          photoSlotBuckets.get(key)!.add(ev.sessionId)
          uniquePhotoSlots.add(ev.sessionId)
        }
        if (ev.action === 'purchase') {
          if (!purchaseBuckets.has(key)) purchaseBuckets.set(key, new Set())
          purchaseBuckets.get(key)!.add(ev.sessionId)
          uniquePurchases.add(ev.sessionId)
          revenue.set(key, (revenue.get(key) || 0) + (ev.params?.value || 0))
        }
      }

      const setToArr = (m: Map<string, Set<string>>) =>
        Array.from(m.entries()).map(([key, s]) => ({ key, value: s.size })).sort((a, b) => a.key.localeCompare(b.key))
      const numToArr = (m: Map<string, number>) =>
        Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key))

      return NextResponse.json({
        buckets: { sessions: setToArr(sessionBuckets), photoSlots: setToArr(photoSlotBuckets), purchases: setToArr(purchaseBuckets), revenue: numToArr(revenue) },
        totals: {
          sessions: uniqueSessions.size,
          photoSlots: uniquePhotoSlots.size,
          purchases: uniquePurchases.size,
          revenue: events.filter(e => e.action === 'purchase').reduce((sum, e) => sum + (e.params?.value || 0), 0),
        },
        granularity,
      })
    }

    // Default: session list
    const limit = Math.min(Number(searchParams.get('limit') || 5000), 10000)
    const filter: any = {}
    if (slug) filter.slug = slug
    if (deviceId) filter.deviceId = deviceId
    if (excludeSessions.length > 0) filter.sessionId = { $nin: excludeSessions }

    const events = await db.collection(COLLECTIONS.userEvents)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    const sessions = new Map<string, any>()
    for (const ev of events) {
      const sid = ev.sessionId
      if (!sessions.has(sid)) {
        sessions.set(sid, {
          sessionId: sid,
          deviceId: ev.deviceId,
          slug: ev.slug,
          userAgent: ev.userAgent || '',
          events: [],
          firstActivity: ev.timestamp,
          lastActivity: ev.timestamp,
        })
      }
      const s = sessions.get(sid)
      if (new Date(ev.timestamp) < new Date(s.firstActivity)) s.firstActivity = ev.timestamp
      if (new Date(ev.timestamp) > new Date(s.lastActivity)) s.lastActivity = ev.timestamp
      s.events.push({
        action: ev.action,
        params: ev.params,
        timestamp: ev.timestamp,
      })
    }

    const result = Array.from(sessions.values())
      .sort((a, b) => new Date(b.firstActivity).getTime() - new Date(a.firstActivity).getTime())

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

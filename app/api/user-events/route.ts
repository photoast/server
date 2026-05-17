import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { sendTelegram, getOrCreateTopic } from '@/lib/customer-email'

function parseUA(ua: string): string {
  if (!ua) return '알 수 없음'
  let device = ''
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Mac/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else device = 'Other'
  let browser = ''
  if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk'
  else if (/NAVER/i.test(ua)) browser = 'Naver'
  else if (/Instagram/i.test(ua)) browser = 'Instagram'
  else if (/CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  return [device, browser].filter(Boolean).join(' · ') || '알 수 없음'
}

const NOTIFY_ACTIONS: Record<string, { emoji: string; label: string }> = {
  page_enter: { emoji: '👋', label: '페이지 접속' },
  crop_open: { emoji: '✂️', label: '포토슬롯 편집' },
  preview_ready: { emoji: '👀', label: '미리보기 진입' },
  purchase: { emoji: '💰', label: '결제 완료' },
  print_request: { emoji: '🖨️', label: '인쇄 요청' },
  payment_fail: { emoji: '❌', label: '결제 실패' },
  page_exit: { emoji: '🚪', label: '페이지 이탈' },
}

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId, deviceId } = await req.json()
    if (!sessionId && !deviceId) {
      return NextResponse.json({ error: 'sessionId or deviceId required' }, { status: 400 })
    }

    const db = await getDb()
    const filter: any = {}
    if (sessionId) filter.sessionId = sessionId
    if (deviceId) filter.deviceId = deviceId

    const result = await db.collection(COLLECTIONS.userEvents).deleteMany(filter)
    return NextResponse.json({ ok: true, deleted: result.deletedCount })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

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

    const notify = NOTIFY_ACTIONS[action]
    if (notify) {
      let shouldSend = true

      if (action === 'crop_open') {
        const prev = await db.collection(COLLECTIONS.userEvents).findOne({
          sessionId, action: 'crop_open', timestamp: { $lt: new Date() },
        })
        if (prev) shouldSend = false
      }

      if (shouldSend) {
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        const device = parseUA(userAgent)
        const threadId = await getOrCreateTopic(deviceId, slug, device)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const logUrl = `${baseUrl}/admin/user-events?deviceId=${deviceId}`
        const lines = [
          `${notify.emoji} *${notify.label}*`,
          ``,
          `📌 /${slug}`,
          `🕐 ${now}`,
          `📱 ${device}`,
          `🆔 \`${deviceId.slice(0, 12)}\``,
          `🔑 \`${sessionId.slice(0, 12)}\``,
        ]
        if (params?.value) lines.push(`💵 ${Number(params.value).toLocaleString()}원`)
        if (params?.slotIndex !== undefined) lines.push(`🖼 슬롯 ${params.slotIndex + 1}`)
        lines.push(``, `[이벤트 로그 보기](${logUrl})`)
        sendTelegram(lines.join('\n'), threadId).catch(() => {})
      }
    }

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
    const excludeDevices = searchParams.get('excludeDevices')?.split(',').filter(Boolean) || []
    const days = Math.min(Number(searchParams.get('days') || 7), 30)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const db = await getDb()

    if (mode === 'stats') {
      const granularity = Math.max(1, Math.min(1440, Number(searchParams.get('granularity') || 60)))

      let since: Date
      let until: Date | null = null
      if (startDate) {
        since = new Date(startDate + 'T00:00:00')
        if (endDate) {
          until = new Date(endDate + 'T23:59:59.999')
        }
      } else {
        since = new Date()
        since.setDate(since.getDate() - days)
      }

      const filter: any = until
        ? { timestamp: { $gte: since, $lte: until } }
        : { timestamp: { $gte: since } }
      if (slug) filter.slug = slug
      if (excludeSessions.length > 0) filter.sessionId = { $nin: excludeSessions }
      if (excludeDevices.length > 0) filter.deviceId = { $nin: excludeDevices }

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
      const downloadBuckets = new Map<string, Set<string>>()
      const revenue = new Map<string, number>()
      const uniqueSessions = new Set<string>()
      const uniquePhotoSlots = new Set<string>()
      const uniquePurchases = new Set<string>()
      const uniqueDownloads = new Set<string>()

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
        if (ev.action === 'download') {
          if (!downloadBuckets.has(key)) downloadBuckets.set(key, new Set())
          downloadBuckets.get(key)!.add(ev.sessionId)
          uniqueDownloads.add(ev.sessionId)
        }
      }

      const setToArr = (m: Map<string, Set<string>>) =>
        Array.from(m.entries()).map(([key, s]) => ({ key, value: s.size })).sort((a, b) => a.key.localeCompare(b.key))
      const numToArr = (m: Map<string, number>) =>
        Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key))

      return NextResponse.json({
        buckets: { sessions: setToArr(sessionBuckets), photoSlots: setToArr(photoSlotBuckets), purchases: setToArr(purchaseBuckets), downloads: setToArr(downloadBuckets), revenue: numToArr(revenue) },
        totals: {
          sessions: uniqueSessions.size,
          photoSlots: uniquePhotoSlots.size,
          purchases: uniquePurchases.size,
          downloads: uniqueDownloads.size,
          revenue: events.filter(e => e.action === 'purchase').reduce((sum, e) => sum + (e.params?.value || 0), 0),
        },
        granularity,
      })
    }

    // Default: session list
    const limit = Math.min(Number(searchParams.get('limit') || 5000), 10000)
    const filter: any = {}
    if (slug) filter.slug = slug
    if (deviceId && excludeDevices.length > 0) {
      filter.$and = [{ deviceId }, { deviceId: { $nin: excludeDevices } }]
    } else if (deviceId) {
      filter.deviceId = deviceId
    } else if (excludeDevices.length > 0) {
      filter.deviceId = { $nin: excludeDevices }
    }
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

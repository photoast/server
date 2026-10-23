import { NextRequest, NextResponse } from 'next/server'

// Bounded process-local limiter: metadata only, no guest photos or contact details.
const recent = new Map<string, number>()
let lastSent = 0
const actions = new Set(['shoot', 'done', 'sending', 'compose-start', 'compose-success', 'compose-error', 'offline', 'online', 'error'])
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) return new NextResponse(null, { status: 413 })
    const raw = await request.text()
    if (raw.length > 2048) return new NextResponse(null, { status: 413 })
    const { slug, action, detail } = JSON.parse(raw)
    if (typeof slug !== 'string' || !/^[\w-]{1,100}$/.test(slug) || !actions.has(action)) return new NextResponse(null, { status: 400 })
    const now = Date.now()
    recent.forEach((time, key) => { if (now - time > 60000) recent.delete(key) })
    const key = `${slug}:${action}`
    if (recent.has(key) && now - recent.get(key)! < 10000) return NextResponse.json({ throttled: true })
    recent.set(key, now)
    const text = `[PhotoToast] ${slug} / ${action}\n${new Date().toISOString()}\n${typeof detail === 'string' ? detail.slice(0, 250).replace(/https?:\/\/\S+/g, '[URL]').replace(/[\w.+-]+@[\w.-]+/g, '[email]') : ''}`
    console.info(text)
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chat = process.env.TELEGRAM_CHAT_ID
    if (!token || !chat) return NextResponse.json({ configured: false })
    // Stay below the free single-chat/group limits; never enable paid broadcasts.
    if (action === 'compose-start' || action === 'compose-success' || now - lastSent < 4000) return NextResponse.json({ throttled: true })
    lastSent = now
    const result = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, allow_paid_broadcast: false }),
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ delivered: result.ok })
  } catch {
    return NextResponse.json({ delivered: false }, { status: 503 })
  }
}

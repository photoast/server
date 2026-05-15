import { NextRequest, NextResponse } from 'next/server'
import { recordPageView, getPageViewStats, getPageViewLogs } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  try {
    const { slug, deviceId } = await request.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    const userAgent = request.headers.get('user-agent') || undefined
    const referrer = request.headers.get('referer') || undefined

    await recordPageView(slug, { userAgent, referrer, deviceId })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to record' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slug = request.nextUrl.searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    const mode = request.nextUrl.searchParams.get('mode')
    if (mode === 'logs') {
      const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
      const logs = await getPageViewLogs(slug, page)
      return NextResponse.json(logs)
    }

    const stats = await getPageViewStats(slug)
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

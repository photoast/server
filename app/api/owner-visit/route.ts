import { NextRequest, NextResponse } from 'next/server'
import { saveOwnerVisit, notifyOwnerVisit, type OwnerVisitDoc } from '@/lib/ownerVisit'

// 캐시 없이 매 요청 처리
export const dynamic = 'force-dynamic'

function getClientIp(request: NextRequest): string | undefined {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || undefined
}

/**
 * /owner 영업 랜딩의 접속·이벤트 로그를 기록하고 텔레그램 등으로 알림을 보낸다.
 * 클라이언트(VisitTracker)가 세션당 1회 호출한다.
 */
export async function POST(request: NextRequest) {
  let body: { type?: string; referrer?: string; screen?: string } = {}
  try {
    body = await request.json()
  } catch {
    // 본문 없이도 'visit'으로 처리
  }

  const doc: OwnerVisitDoc = {
    type: typeof body.type === 'string' && body.type ? body.type : 'visit',
    referrer: typeof body.referrer === 'string' && body.referrer ? body.referrer : undefined,
    screen: typeof body.screen === 'string' && body.screen ? body.screen : undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: getClientIp(request),
    createdAt: new Date(),
  }

  // 저장 실패가 알림을 막지 않도록 병렬 처리
  await Promise.all([saveOwnerVisit(doc), notifyOwnerVisit(doc)])

  return NextResponse.json({ ok: true })
}

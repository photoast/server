import { NextRequest, NextResponse } from 'next/server'
import { validateLead, saveLead, notifyLead, type LeadDoc } from '@/lib/leads'

/**
 * 생일카페 영업 랜딩(/owner) CTA 폼 제출 엔드포인트.
 *
 * 무거운 백엔드 없이 동작하도록 설계: 들어온 리드를 MongoDB에 저장하고
 * (lib/leads) 텔레그램/슬랙/디스코드 웹훅으로 즉시 알림을 쏜다.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const result = validateLead(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const doc: LeadDoc = {
    ...result.data,
    createdAt: new Date(),
    source: request.headers.get('referer') || undefined,
  }

  // DB 저장 실패가 알림을 막지 않도록 병렬 처리
  await Promise.all([saveLead(doc), notifyLead(doc)])

  return NextResponse.json({ ok: true })
}

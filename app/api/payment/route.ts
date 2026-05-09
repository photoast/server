import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug } from '@/lib/models'

function getNicepayApiUrl() {
  const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || ''
  const isSandbox = clientId.startsWith('S2_') || clientId.startsWith('S1_')
  return isSandbox ? 'https://sandbox-api.nicepay.co.kr' : 'https://api.nicepay.co.kr'
}

// 나이스페이 결제 승인 API (returnUrl에서 리다이렉트 후 클라이언트가 호출)
export async function POST(request: NextRequest) {
  try {
    const { tid, amount, orderId, eventSlug } = await request.json()

    if (!tid || !amount || !orderId || !eventSlug) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    const event = await findEventBySlug(eventSlug)
    if (!event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID
    const secretKey = process.env.NICEPAY_SECRET_KEY
    if (!clientId || !secretKey) {
      console.error('NICEPAY credentials not configured')
      return NextResponse.json(
        { error: '결제 설정이 완료되지 않았습니다' },
        { status: 500 }
      )
    }

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64')

    const response = await fetch(`${getNicepayApiUrl()}/v1/payments/${tid}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount }),
    })

    const data = await response.json()

    if (data.resultCode !== '0000') {
      console.error('NicePay payment error:', data)
      return NextResponse.json(
        { error: data.resultMsg || '결제 승인에 실패했습니다' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      tid: data.tid,
      orderId: data.orderId,
      status: data.status,
      amount: data.amount,
    })

  } catch (error: any) {
    console.error('Payment API error:', error)
    return NextResponse.json(
      { error: error.message || '결제 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

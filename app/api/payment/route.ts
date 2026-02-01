import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug } from '@/lib/models'

// 토스페이먼츠 결제 승인 API
export async function POST(request: NextRequest) {
  try {
    const { paymentKey, orderId, amount, eventSlug } = await request.json()

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount || !eventSlug) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    // 이벤트 정보 조회
    const event = await findEventBySlug(eventSlug)
    if (!event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 이벤트별 금액 검증
    const expectedAmount = event.price ?? 10
    if (amount !== expectedAmount) {
      return NextResponse.json(
        { error: `잘못된 결제 금액입니다. 예상 금액: ${expectedAmount}원` },
        { status: 400 }
      )
    }

    const secretKey = process.env.TOSS_SECRET_KEY
    if (!secretKey) {
      console.error('TOSS_SECRET_KEY not configured')
      return NextResponse.json(
        { error: '결제 설정이 완료되지 않았습니다' },
        { status: 500 }
      )
    }

    // Base64 인코딩
    const encryptedSecretKey = Buffer.from(secretKey + ':').toString('base64')

    // 토스페이먼츠 결제 승인 요청
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Toss payment error:', data)
      return NextResponse.json(
        { error: data.message || '결제 승인에 실패했습니다' },
        { status: response.status }
      )
    }

    // 결제 성공
    return NextResponse.json({
      success: true,
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
    })

  } catch (error: any) {
    console.error('Payment API error:', error)
    return NextResponse.json(
      { error: error.message || '결제 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

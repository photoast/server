import { NextRequest, NextResponse } from 'next/server'

// 토스페이먼츠 결제 승인 API
export async function POST(request: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await request.json()

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    // 금액 검증 (10원)
    if (amount !== 10) {
      return NextResponse.json(
        { error: '잘못된 결제 금액입니다' },
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

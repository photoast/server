import { NextRequest, NextResponse } from 'next/server'

// 나이스페이 결제창에서 인증 완료 후 POST로 호출되는 returnUrl
// 인증 결과를 받아서 클라이언트 페이지로 리다이렉트
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const authResultCode = formData.get('authResultCode') as string
    const authResultMsg = formData.get('authResultMsg') as string
    const tid = formData.get('tid') as string
    const orderId = formData.get('orderId') as string
    const amount = formData.get('amount') as string
    const returnPath = formData.get('mallReserved') as string || '/'

    if (authResultCode === '0000' && tid) {
      const params = new URLSearchParams({
        payment: 'success',
        tid,
        orderId: orderId || '',
        amount: amount || '',
      })
      return NextResponse.redirect(
        new URL(`${returnPath}?${params.toString()}`, request.url),
        { status: 303 }
      )
    } else {
      const params = new URLSearchParams({
        payment: 'fail',
        errorMsg: authResultMsg || '결제 인증에 실패했습니다',
      })
      return NextResponse.redirect(
        new URL(`${returnPath}?${params.toString()}`, request.url),
        { status: 303 }
      )
    }
  } catch (error) {
    console.error('NicePay return handler error:', error)
    return NextResponse.redirect(
      new URL('/?payment=fail&errorMsg=결제 처리 중 오류', request.url),
      { status: 303 }
    )
  }
}

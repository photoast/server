import { NextRequest, NextResponse } from 'next/server'
import { findPrintJobById } from '@/lib/models'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { checkAuth } from '@/lib/middleware'

const NICEPAY_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.nicepay.co.kr'
  : 'https://sandbox-api.nicepay.co.kr'

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { printJobId, reason } = await request.json()

    if (!printJobId) {
      return NextResponse.json({ error: 'printJobId가 필요합니다' }, { status: 400 })
    }

    const job = await findPrintJobById(printJobId)
    if (!job) {
      return NextResponse.json({ error: '인쇄 작업을 찾을 수 없습니다' }, { status: 404 })
    }

    if (job.refunded) {
      return NextResponse.json({ error: '이미 취소된 결제입니다' }, { status: 400 })
    }

    if (!job.paymentTid) {
      return NextResponse.json({ error: '결제 정보(TID)가 없는 작업입니다' }, { status: 400 })
    }

    const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID
    const secretKey = process.env.NICEPAY_SECRET_KEY
    if (!clientId || !secretKey) {
      return NextResponse.json({ error: '결제 설정이 완료되지 않았습니다' }, { status: 500 })
    }

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64')

    const response = await fetch(`${NICEPAY_API_URL}/v1/payments/${job.paymentTid}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason || '관리자 취소',
        orderId: job.paymentTid,
      }),
    })

    const data = await response.json()

    if (data.resultCode !== '0000') {
      console.error('NicePay cancel error:', data)
      return NextResponse.json(
        { error: data.resultMsg || '결제 취소에 실패했습니다' },
        { status: 400 }
      )
    }

    const db = await getDb()
    await db.collection(COLLECTIONS.printJobs).updateOne(
      { _id: new ObjectId(printJobId) },
      { $set: { refunded: true } }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Payment cancel error:', error)
    return NextResponse.json(
      { error: error.message || '결제 취소 처리 중 오류' },
      { status: 500 }
    )
  }
}

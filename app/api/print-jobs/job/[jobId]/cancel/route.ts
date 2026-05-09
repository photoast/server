import { NextRequest, NextResponse } from 'next/server'
import { findPrintJobById, findEventById } from '@/lib/models'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { sendCustomerEmail } from '@/lib/customer-email'

function getNicepayApiUrl() {
  const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || ''
  const isSandbox = clientId.startsWith('S2_') || clientId.startsWith('S1_')
  return isSandbox ? 'https://sandbox-api.nicepay.co.kr' : 'https://api.nicepay.co.kr'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const job = await findPrintJobById(params.jobId)
    if (!job) {
      return NextResponse.json({ error: '인쇄 작업을 찾을 수 없습니다' }, { status: 404 })
    }

    if (job.refunded) {
      return NextResponse.json({ error: '이미 취소된 결제입니다' }, { status: 400 })
    }

    if (job.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 인쇄가 시작되어 취소할 수 없습니다' }, { status: 400 })
    }

    const db = await getDb()

    if (job.paymentTid) {
      const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID
      const secretKey = process.env.NICEPAY_SECRET_KEY
      if (!clientId || !secretKey) {
        return NextResponse.json({ error: '결제 설정이 완료되지 않았습니다' }, { status: 500 })
      }

      const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64')
      const response = await fetch(`${getNicepayApiUrl()}/v1/payments/${job.paymentTid}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: '사용자 취소',
          orderId: job.paymentTid,
        }),
      })

      const data = await response.json()
      if (data.resultCode !== '0000') {
        console.error('NicePay cancel error:', data)
        return NextResponse.json({ error: data.resultMsg || '결제 취소에 실패했습니다' }, { status: 400 })
      }
    }

    await db.collection(COLLECTIONS.printJobs).updateOne(
      { _id: new ObjectId(params.jobId) },
      { $set: { refunded: true, status: 'CANCELLED' } }
    )

    if (job.customerEmail) {
      const event = await findEventById(job.eventId)
      sendCustomerEmail({
        to: job.customerEmail,
        type: 'refund_complete',
        eventName: event?.name || '포토토스트',
        orderNumber: job.orderNumber,
        amount: job.paymentAmount,
        jobId: params.jobId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('User cancel error:', error)
    return NextResponse.json({ error: error.message || '취소 처리 중 오류' }, { status: 500 })
  }
}

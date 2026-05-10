import { NextRequest, NextResponse } from 'next/server'
import { authenticatePrinterClient } from '@/lib/printer-auth'
import { findPrintJobById, updatePrintJobStatus, findEventById } from '@/lib/models'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { sendCustomerEmail } from '@/lib/customer-email'

function getNicepayApiUrl() {
  const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || ''
  const isSandbox = clientId.startsWith('S2_') || clientId.startsWith('S1_')
  return isSandbox ? 'https://sandbox-api.nicepay.co.kr' : 'https://api.nicepay.co.kr'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const printer = await authenticatePrinterClient(request)
    if (!printer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, errorMessage } = body

    if (!['PRINTING', 'DONE', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be PRINTING, DONE or FAILED' },
        { status: 400 }
      )
    }

    const job = await findPrintJobById(params.jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.printerId !== printer._id!.toString()) {
      return NextResponse.json({ error: 'Job does not belong to this printer' }, { status: 403 })
    }
    if (job.status === 'DONE' || job.status === 'FAILED') {
      return NextResponse.json(
        { error: `Job is already ${job.status}` },
        { status: 409 }
      )
    }

    const success = await updatePrintJobStatus(params.jobId, status, errorMessage)
    if (!success) {
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    const event = await findEventById(job.eventId)

    if (status === 'DONE' && job.customerEmail) {
      sendCustomerEmail({
        to: job.customerEmail,
        type: 'print_complete',
        eventName: event?.name || '포토토스트',
        orderNumber: job.orderNumber,
        jobId: params.jobId,
      })
    }

    if (status === 'FAILED' && job.paymentTid && !job.refunded) {
      try {
        const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID
        const secretKey = process.env.NICEPAY_SECRET_KEY
        if (clientId && secretKey) {
          const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64')
          const cancelRes = await fetch(`${getNicepayApiUrl()}/v1/payments/${job.paymentTid}/cancel`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: '인쇄 실패 자동 환불', orderId: job.paymentTid }),
          })
          const cancelData = await cancelRes.json()
          if (cancelData.resultCode === '0000') {
            const db = await getDb()
            await db.collection(COLLECTIONS.printJobs).updateOne(
              { _id: new ObjectId(params.jobId) },
              { $set: { refunded: true } }
            )
            if (job.customerEmail) {
              sendCustomerEmail({
                to: job.customerEmail,
                type: 'refund_complete',
                eventName: event?.name || '포토토스트',
                orderNumber: job.orderNumber,
                amount: job.paymentAmount,
                jobId: params.jobId,
              })
            }
          } else {
            console.error('Auto-refund failed:', cancelData)
          }
        }
      } catch (refundErr) {
        console.error('Auto-refund error:', refundErr)
      }
    }

    return NextResponse.json({ success: true, jobId: params.jobId, status })
  } catch (error) {
    console.error('Error updating job status:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

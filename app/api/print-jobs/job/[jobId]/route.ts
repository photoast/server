import { NextRequest, NextResponse } from 'next/server'
import { findPrintJobById, updatePrintJobStatus } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

// GET: 공개 — 단일 인쇄 결과 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const job = await findPrintJobById(params.jobId)
    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const createdAt = new Date(job.createdAt).getTime()
    const now = Date.now()
    const expiresAt = createdAt + 24 * 60 * 60 * 1000
    if (now > expiresAt) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }

    return NextResponse.json({
      jobId: job._id!.toString(),
      status: job.status,
      imageUrl: job.imageUrl,
      printedImageUrl: job.printedImageUrl,
      orderNumber: job.orderNumber,
      createdAt: job.createdAt,
      expiresAt: new Date(expiresAt).toISOString(),
      refunded: job.refunded || false,
      paymentTid: job.paymentTid,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
  }
}

// PATCH: 어드민 전용 — 인쇄 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, errorMessage } = body

    if (!['PENDING', 'PRINTING', 'DONE', 'FAILED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be PENDING, PRINTING, DONE, or FAILED' }, { status: 400 })
    }

    const success = await updatePrintJobStatus(params.jobId, status, errorMessage)
    if (!success) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, jobId: params.jobId, status })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

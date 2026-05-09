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

    return NextResponse.json({
      jobId: job._id!.toString(),
      status: job.status,
      imageUrl: job.imageUrl,
      printedImageUrl: job.printedImageUrl,
      orderNumber: job.orderNumber,
      createdAt: job.createdAt,
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

    if (!['PENDING', 'DONE', 'FAILED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be PENDING, DONE, or FAILED' }, { status: 400 })
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

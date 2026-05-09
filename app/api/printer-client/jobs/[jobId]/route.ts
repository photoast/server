import { NextRequest, NextResponse } from 'next/server'
import { authenticatePrinterClient } from '@/lib/printer-auth'
import { findPrintJobById, updatePrintJobStatus, findEventById } from '@/lib/models'
import { sendCustomerEmail } from '@/lib/customer-email'

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

    if (status === 'DONE' && job.customerEmail) {
      const event = await findEventById(job.eventId)
      sendCustomerEmail({
        to: job.customerEmail,
        type: 'print_complete',
        eventName: event?.name || '포토토스트',
        orderNumber: job.orderNumber,
        jobId: params.jobId,
      })
    }

    return NextResponse.json({ success: true, jobId: params.jobId, status })
  } catch (error) {
    console.error('Error updating job status:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

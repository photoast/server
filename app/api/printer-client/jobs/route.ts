import { NextRequest, NextResponse } from 'next/server'
import { authenticatePrinterClient } from '@/lib/printer-auth'
import { getPendingJobsByPrinterId } from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    const printer = await authenticatePrinterClient(request)
    if (!printer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobs = await getPendingJobsByPrinterId(printer._id!.toString())

    const baseUrl = request.nextUrl.origin
    const response = jobs.map(job => ({
      jobId: job._id!.toString(),
      imageUrl: job.printedImageUrl
        ? `${baseUrl}${job.printedImageUrl}`
        : `${baseUrl}${job.imageUrl}`,
      createdAt: job.createdAt.toISOString(),
    }))

    return NextResponse.json({ jobs: response })
  } catch (error) {
    console.error('Error fetching pending jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

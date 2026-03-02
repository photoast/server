import { NextRequest, NextResponse } from 'next/server'
import { getPrintJobsByEventId, getAllPrinters } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [printJobs, printers] = await Promise.all([
      getPrintJobsByEventId(params.eventId),
      getAllPrinters(),
    ])

    const printerMap = new Map(printers.map(p => [p._id!.toString(), p.name]))

    const enriched = printJobs.map(job => ({
      ...job,
      printerName: job.printerId ? printerMap.get(job.printerId) || null : null,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error fetching print jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch print jobs' },
      { status: 500 }
    )
  }
}

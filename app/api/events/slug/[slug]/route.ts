import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug, findPrinterById } from '@/lib/models'

// GET event by slug (public endpoint for guests)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const event = await findEventBySlug(params.slug)

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Resolve printer's supported sizes for client-side layout filtering
    let supportedSizes: string[] | undefined
    let isTestPrinter = false
    if (event.printerId) {
      const printer = await findPrinterById(event.printerId)
      if (printer?.supportedSizes) {
        supportedSizes = printer.supportedSizes
      }
      // 테스트용 프린터면 게스트에게 "실제 인쇄되지 않음"을 미리 알리기 위한 플래그
      isTestPrinter = printer?.printMethod === 'test'
    }

    return NextResponse.json({ ...event, supportedSizes, isTestPrinter })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

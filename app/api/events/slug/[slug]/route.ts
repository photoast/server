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
    if (event.printerId) {
      const printer = await findPrinterById(event.printerId)
      if (printer?.supportedSizes) {
        supportedSizes = printer.supportedSizes
      }
    }

    return NextResponse.json({ ...event, supportedSizes })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getLayoutsByEventId, createLayout } from '@/lib/models'
import { PRINT_SIZE_DIMENSIONS, PrintSize } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }
  let layouts = await getLayoutsByEventId(eventId)
  if (searchParams.get('visibleOnly') === 'true') {
    layouts = layouts.filter(l => l.visible !== false)
  }
  return NextResponse.json(layouts)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, name, printSize } = body

    if (!eventId || !name || !printSize) {
      return NextResponse.json({ error: 'eventId, name, printSize are required' }, { status: 400 })
    }

    const dims = PRINT_SIZE_DIMENSIONS[printSize as PrintSize]
    if (!dims) {
      return NextResponse.json({ error: 'Invalid printSize. Use 4x6, 2x6, or 6x4' }, { status: 400 })
    }

    const layout = await createLayout({
      eventId,
      name,
      printSize: printSize as PrintSize,
      canvasWidth: dims.width,
      canvasHeight: dims.height,
      slots: [],
      frameLayers: [],
      frameUrl: null,
    })

    return NextResponse.json(layout, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create layout' }, { status: 500 })
  }
}

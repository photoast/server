import { NextRequest, NextResponse } from 'next/server'
import { createEvent, getAllEvents } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'
import memoryDB from '@/lib/memorydb'
import { DEFAULT_LAYOUT_TEMPLATES } from '@/lib/defaultLayoutTemplates'

// GET all events
export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const events = await getAllEvents()
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST create new event
export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, printMethod = 'email' } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36)

    const event = await createEvent({
      name,
      slug,
      printMethod,
      borderCorrectionEnabled: printMethod === 'email',
    })

    // 기본 레이아웃 템플릿 자동 생성
    const eventId = String(event._id)
    for (let idx = 0; idx < DEFAULT_LAYOUT_TEMPLATES.length; idx++) {
      const template = DEFAULT_LAYOUT_TEMPLATES[idx]
      await memoryDB.createLayout({
        eventId,
        name: template.name,
        printSize: template.printSize,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
        slots: template.slots.map((s, i) => ({ ...s, id: `slot-${i}`, order: i, zIndex: 10 + i, rotation: 0 })),
        frameLayers: template.frameLayers || [],
        frameUrl: null,
        isPreset: true,
        order: idx,
      })
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

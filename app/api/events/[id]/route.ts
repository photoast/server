import { NextRequest, NextResponse } from 'next/server'
import { findEventById, updateEvent } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

// GET event by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await findEventById(params.id)

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

// PATCH update event
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, printerUrl, logoUrl, photoAreaRatio, logoSettings, availableLayouts } = body

    const updates: any = {}
    if (name) updates.name = name
    if (printerUrl) updates.printerUrl = printerUrl
    if (logoUrl !== undefined) updates.logoUrl = logoUrl
    if (photoAreaRatio !== undefined) updates.photoAreaRatio = photoAreaRatio
    if (logoSettings !== undefined) updates.logoSettings = logoSettings
    if (availableLayouts !== undefined) updates.availableLayouts = availableLayouts

    const success = await updateEvent(params.id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const updatedEvent = await findEventById(params.id)
    return NextResponse.json(updatedEvent)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { findEventById, updateEvent, deleteEvent } from '@/lib/models'
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
    const { name, printerId, availableLayouts, price, puzzleEnabled, backgroundColors } = body

    const updates: any = {}
    if (name) updates.name = name
    if (printerId !== undefined) updates.printerId = printerId
    if (availableLayouts !== undefined) updates.availableLayouts = availableLayouts
    if (price !== undefined) updates.price = price
    if (puzzleEnabled !== undefined) updates.puzzleEnabled = puzzleEnabled
    if (backgroundColors !== undefined) updates.backgroundColors = backgroundColors

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

// DELETE event
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deleted = await deleteEvent(params.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}

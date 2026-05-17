import { NextRequest, NextResponse } from 'next/server'
import { findEventById, findEventBySlug, updateEvent, deleteEvent } from '@/lib/models'
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
    const { name, slug, printerId, availableLayouts, price, paymentMethods, backgroundColors, donation, logoUrl, contactPhone } = body

    const updates: any = {}
    if (name) updates.name = name
    if (slug !== undefined) {
      const sanitized = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!sanitized) {
        return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
      }
      const existing = await findEventBySlug(sanitized)
      if (existing && existing._id?.toString() !== params.id) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
      }
      updates.slug = sanitized
    }
    if (printerId !== undefined) updates.printerId = printerId
    if (availableLayouts !== undefined) updates.availableLayouts = availableLayouts
    if (price !== undefined) updates.price = price
    if (paymentMethods !== undefined) updates.paymentMethods = paymentMethods
    if (backgroundColors !== undefined) updates.backgroundColors = backgroundColors
    if (donation !== undefined) updates.donation = donation
    if (logoUrl !== undefined) updates.logoUrl = logoUrl
    if (contactPhone !== undefined) updates.contactPhone = contactPhone
    if (body.endedAt !== undefined) updates.endedAt = body.endedAt

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

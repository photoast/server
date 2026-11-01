import { QR_PROMO_DEFAULTS } from '@/lib/qrPromo'
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
    const { name, slug, printerId, availableLayouts, price, paymentMethods, backgroundColors, donation, logoUrl, contactPhone, authCodeRequired, boothLayoutId, boothCountdownSeconds, boothSampleImageUrl } = body

    const updates: any = {}
    if (body.qrPromoText !== undefined) {
      const value = body.qrPromoText
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.entries(value).some(([key, text]) => !Object.prototype.hasOwnProperty.call(QR_PROMO_DEFAULTS, key) || typeof text !== 'string' || text.length > 160 || /[\r\n]/.test(text))) {
        return NextResponse.json({ error: 'QR 문구는 항목별 한 줄, 160자 이하로 입력해 주세요.' }, { status: 400 })
      }
      if (value.textSize !== undefined && !['normal', 'large', 'extraLarge'].includes(value.textSize)) {
        return NextResponse.json({ error: '안내 글씨 크기를 확인해 주세요.' }, { status: 400 })
      }
      updates.qrPromoText = value
    }
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
    if (authCodeRequired !== undefined) updates.authCodeRequired = authCodeRequired
    if (boothLayoutId !== undefined) updates.boothLayoutId = boothLayoutId || ''
    if (boothSampleImageUrl !== undefined) {
      if (typeof boothSampleImageUrl !== 'string' || (boothSampleImageUrl !== '' && !/^(https?:\/\/|\/uploads\/|\/api\/serve-image\/)/i.test(boothSampleImageUrl))) {
        return NextResponse.json({ error: '샘플 사진 주소를 확인해 주세요.' }, { status: 400 })
      }
      updates.boothSampleImageUrl = boothSampleImageUrl
    }
    if (boothCountdownSeconds !== undefined) {
      const seconds = Number(boothCountdownSeconds)
      if (!Number.isInteger(seconds) || seconds < 3 || seconds > 15) {
        return NextResponse.json({ error: 'boothCountdownSeconds must be between 3 and 15' }, { status: 400 })
      }
      updates.boothCountdownSeconds = seconds
    }

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

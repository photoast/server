import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug, getRandomBoothPhotos } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const event = await findEventBySlug(params.slug)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    // Only image URLs are public; print/customer/payment records stay private.
    const photos = await getRandomBoothPhotos(event._id!.toString())
    return NextResponse.json({ photos }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error loading booth photos:', error)
    return NextResponse.json({ error: 'Could not load photos' }, { status: 500 })
  }
}

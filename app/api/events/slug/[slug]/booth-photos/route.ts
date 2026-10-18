import { NextRequest, NextResponse } from 'next/server'
import { getRandomPreviewConfig } from '@/lib/boothRandomPreviews'
import { findEventBySlug, getRandomBoothPhotos, getLayoutById } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const event = await findEventBySlug(params.slug)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    // Only image URLs are public; print/customer/payment records stay private.
    const layout = event.boothLayoutId ? await getLayoutById(event.boothLayoutId) : null
    if (!layout || layout.eventId !== event._id!.toString() || layout.visible === false) {
      return NextResponse.json({ photos: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const source = layout.boothPreviewSource || 'samples'
    const sampleUrls = Array.from(new Set([layout.testPreviewImageUrl, ...(layout.previewImageUrls || [])].filter((url): url is string => Boolean(url))))
    const randomPreview = getRandomPreviewConfig(layout)
    const samplesOnly = source === 'samples' && (sampleUrls.length > 0 || Boolean(randomPreview))
    const printed = samplesOnly ? [] : await getRandomBoothPhotos(event._id!.toString(), layout._id)
    const urls = Array.from(new Set([...(source === 'prints' ? [] : sampleUrls), ...printed.map(photo => photo.imageUrl)]))
    for (let i = urls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[urls[i], urls[j]] = [urls[j], urls[i]]
    }
    return NextResponse.json({ photos: urls.slice(0, 6).map(imageUrl => ({ imageUrl })), isSampleOnly: samplesOnly, randomPreview }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error loading booth photos:', error)
    return NextResponse.json({ error: 'Could not load photos' }, { status: 500 })
  }
}

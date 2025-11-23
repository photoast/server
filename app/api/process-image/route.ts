import { NextRequest, NextResponse } from 'next/server'
import { processImage, saveUploadedFile } from '@/lib/image'
import { findEventBySlug } from '@/lib/models'
import { FrameType } from '@/lib/types'
import path from 'path'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const slug = formData.get('slug') as string
    const cropDataStr = formData.get('cropArea') as string | null
    const cropAreasStr = formData.get('cropAreas') as string | null
    const frameType = (formData.get('frameType') as string || 'single') as FrameType
    const backgroundColor = formData.get('backgroundColor') as string | null
    const showLogoStr = formData.get('showLogo') as string | null
    const showLogo = showLogoStr === 'true'

    if (!slug) {
      return NextResponse.json(
        { error: 'Event slug is required' },
        { status: 400 }
      )
    }

    // Get event
    const event = await findEventBySlug(slug)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Define expected photo counts for each layout
    const photoCountMap: Record<FrameType, number> = {
      'single': 1,
      'vertical-two': 2,
      'horizontal-two': 2,
      'one-plus-two': 3,
      'four-cut': 4,
      'two-by-two': 4,
    }

    const expectedCount = photoCountMap[frameType]
    const isMultiPhoto = expectedCount > 1

    // Handle different frame types
    let buffers: Buffer | Buffer[]

    if (isMultiPhoto) {
      // Get all photos for multi-photo layouts
      const photos = formData.getAll('photos') as File[]

      if (photos.length !== expectedCount) {
        return NextResponse.json(
          { error: `${frameType} frame requires exactly ${expectedCount} photos, but received ${photos.length}` },
          { status: 400 }
        )
      }

      buffers = await Promise.all(
        photos.map(photo => photo.arrayBuffer().then(ab => Buffer.from(ab)))
      )
    } else {
      // Single photo
      const file = formData.get('photo') as File

      if (!file) {
        return NextResponse.json(
          { error: 'Photo is required' },
          { status: 400 }
        )
      }

      buffers = Buffer.from(await file.arrayBuffer())
    }

    // Parse crop area(s) if provided
    let cropArea = null
    if (isMultiPhoto && cropAreasStr) {
      // Multi-photo layouts use crop areas array
      try {
        cropArea = JSON.parse(cropAreasStr)
        console.log('Crop areas received:', cropArea)
      } catch (e) {
        console.error('Failed to parse crop areas:', e)
      }
    } else if (cropDataStr) {
      // Single photo uses single crop area
      try {
        cropArea = JSON.parse(cropDataStr)
      } catch (e) {
        console.error('Failed to parse crop area:', e)
      }
    }

    // Get photo area ratio from event (default 85%)
    // If logo is disabled for single photo, use 100% (full area)
    let photoAreaRatio = event.photoAreaRatio ?? 85
    if (frameType === 'single' && !showLogo) {
      photoAreaRatio = 100 // Use full area when logo is disabled
    }

    // Process image (crop + resize + add logo)
    // For single photo, check showLogo flag
    const finalLogoUrl = (frameType === 'single' && !showLogo) ? undefined : event.logoUrl

    const processedBuffer = await processImage(
      buffers,
      finalLogoUrl,
      cropArea,
      photoAreaRatio,
      event.logoSettings,
      frameType,
      backgroundColor || undefined
    )

    // Save processed image
    const timestamp = Date.now()
    const filename = `processed-${timestamp}.jpg`

    // In Vercel (serverless), use /tmp directory
    // In local development, use public/uploads
    const isVercel = process.env.VERCEL === '1'

    if (isVercel) {
      const uploadDir = '/tmp/uploads'
      await fs.mkdir(uploadDir, { recursive: true })
      const filepath = path.join(uploadDir, filename)
      await fs.writeFile(filepath, processedBuffer)

      // Return API route URL to serve the image
      return NextResponse.json({ url: `/api/serve-image/${filename}` })
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      await fs.mkdir(uploadDir, { recursive: true })
      const filepath = path.join(uploadDir, filename)
      await fs.writeFile(filepath, processedBuffer)

      return NextResponse.json({ url: `/uploads/${filename}` })
    }
  } catch (error) {
    console.error('Error processing image:', error)
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}

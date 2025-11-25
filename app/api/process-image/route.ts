import { NextRequest, NextResponse } from 'next/server'
import { processImage, saveUploadedFile } from '@/lib/image'
import { findEventBySlug } from '@/lib/models'
import { FrameType } from '@/lib/types'
import path from 'path'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Process image request received')
    const formData = await request.formData()
    const slug = formData.get('slug') as string
    const cropDataStr = formData.get('cropArea') as string | null
    const cropAreasStr = formData.get('cropAreas') as string | null
    const frameType = (formData.get('frameType') as string || 'single') as FrameType
    const backgroundColor = formData.get('backgroundColor') as string | null

    console.log('[API] Request params:', { slug, frameType, hasCropArea: !!cropDataStr, hasCropAreas: !!cropAreasStr, backgroundColor })

    if (!slug) {
      console.error('[API] Error: Event slug is required')
      return NextResponse.json(
        { error: 'Event slug is required' },
        { status: 400 }
      )
    }

    // Get event
    const event = await findEventBySlug(slug)
    if (!event) {
      console.error('[API] Error: Event not found:', slug)
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    console.log('[API] Event found:', event.name)

    // Define expected photo counts for each layout
    const photoCountMap: Record<FrameType, number> = {
      'single': 1,
      'single-with-logo': 1,
      'vertical-two': 2,
      'one-plus-two': 3,
      'four-cut': 4,
      'two-by-two': 4,
    }

    const expectedCount = photoCountMap[frameType]
    const isMultiPhoto = expectedCount > 1

    console.log('[API] Photo requirements:', { frameType, expectedCount, isMultiPhoto })

    // Handle different frame types
    let buffers: Buffer | Buffer[]

    if (isMultiPhoto) {
      // Get all photos for multi-photo layouts
      const photos = formData.getAll('photos') as File[]

      console.log('[API] Multi-photo mode:', {
        received: photos.length,
        expected: expectedCount,
        fileNames: photos.map(p => p.name),
        fileSizes: photos.map(p => p.size),
        fileTypes: photos.map(p => p.type)
      })

      if (photos.length !== expectedCount) {
        const errorMsg = `${frameType} frame requires exactly ${expectedCount} photos, but received ${photos.length}`
        console.error('[API] Error:', errorMsg)
        return NextResponse.json(
          { error: errorMsg },
          { status: 400 }
        )
      }

      console.log('[API] Converting photos to buffers...')
      buffers = await Promise.all(
        photos.map(async (photo, index) => {
          const ab = await photo.arrayBuffer()
          const buffer = Buffer.from(ab)
          console.log(`[API] Photo ${index + 1} buffer created:`, buffer.length, 'bytes')
          return buffer
        })
      )
      console.log('[API] All photo buffers created')
    } else {
      // Single photo
      const file = formData.get('photo') as File

      console.log('[API] Single photo mode:', {
        hasFile: !!file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type
      })

      if (!file) {
        console.error('[API] Error: Photo is required')
        return NextResponse.json(
          { error: 'Photo is required' },
          { status: 400 }
        )
      }

      console.log('[API] Converting photo to buffer...')
      buffers = Buffer.from(await file.arrayBuffer())
      console.log('[API] Photo buffer created:', buffers.length, 'bytes')
    }

    // Parse crop area(s) if provided
    let cropArea = null
    if (isMultiPhoto && cropAreasStr) {
      // Multi-photo layouts use crop areas array
      try {
        cropArea = JSON.parse(cropAreasStr)
        console.log('[API] Crop areas parsed:', cropArea)
      } catch (e) {
        console.error('[API] Failed to parse crop areas:', e)
      }
    } else if (cropDataStr) {
      // Single photo uses single crop area
      try {
        cropArea = JSON.parse(cropDataStr)
        console.log('[API] Crop area parsed:', cropArea)
      } catch (e) {
        console.error('[API] Failed to parse crop area:', e)
      }
    }

    // Get photo area ratio from event (default 85%)
    let photoAreaRatio = event.photoAreaRatio ?? 85

    // Only apply logo to specific layouts
    // single-with-logo: always shows logo if available
    // four-cut: shows logo overlay if available
    const shouldHaveLogo = frameType === 'single-with-logo' || frameType === 'four-cut'
    const finalLogoUrl = shouldHaveLogo ? (event.logoUrl || undefined) : undefined

    console.log('[API] Processing image with settings:', {
      frameType,
      hasLogo: !!finalLogoUrl,
      logoUrl: finalLogoUrl,
      photoAreaRatio,
      logoSettings: event.logoSettings,
      backgroundColor
    })

    console.log('[API] Calling processImage...')
    const processedBuffer = await processImage(
      buffers,
      finalLogoUrl,
      cropArea,
      photoAreaRatio,
      event.logoSettings,
      frameType,
      backgroundColor || undefined
    )
    console.log('[API] Image processed successfully, buffer size:', processedBuffer.length, 'bytes')

    // Save processed image
    const timestamp = Date.now()
    const filename = `processed-${timestamp}.jpg`

    // In Vercel (serverless), use /tmp directory
    // In local development, use public/uploads
    const isVercel = process.env.VERCEL === '1'

    console.log('[API] Saving processed image:', { filename, isVercel })

    if (isVercel) {
      const uploadDir = '/tmp/uploads'
      await fs.mkdir(uploadDir, { recursive: true })
      const filepath = path.join(uploadDir, filename)
      await fs.writeFile(filepath, processedBuffer)
      console.log('[API] File saved to:', filepath)

      // Return API route URL to serve the image
      const url = `/api/serve-image/${filename}`
      console.log('[API] Success! Returning URL:', url)
      return NextResponse.json({ url })
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      await fs.mkdir(uploadDir, { recursive: true })
      const filepath = path.join(uploadDir, filename)
      await fs.writeFile(filepath, processedBuffer)
      console.log('[API] File saved to:', filepath)

      const url = `/uploads/${filename}`
      console.log('[API] Success! Returning URL:', url)
      return NextResponse.json({ url })
    }
  } catch (error) {
    console.error('[API] ERROR processing image:', error)
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    )
  }
}

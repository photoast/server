import { NextRequest, NextResponse } from 'next/server'
import { processImage, saveUploadedFile } from '@/lib/image'
import { findEventBySlug } from '@/lib/models'
import { FrameType } from '@/lib/types'
import path from 'path'
import fs from 'fs/promises'
// @ts-ignore - heic-convert doesn't have TypeScript definitions
import convert from 'heic-convert'

// Next.js App Router configuration
export const runtime = 'nodejs'
export const maxDuration = 300 // Maximum execution time in seconds (5 minutes)

// Convert HEIC to JPEG
async function convertHeicToJpeg(buffer: Buffer, filename: string): Promise<Buffer> {
  try {
    console.log(`[HEIC] Converting ${filename} to JPEG...`)
    const outputBuffer = await convert({
      buffer,
      format: 'JPEG',
      quality: 1 // 0-1, 1 is best quality
    }) as ArrayBuffer
    console.log(`[HEIC] Conversion successful: ${buffer.length} bytes → ${outputBuffer.byteLength} bytes`)
    return Buffer.from(outputBuffer)
  } catch (error) {
    console.error(`[HEIC] Conversion failed for ${filename}:`, error)
    throw new Error(`Failed to convert HEIC image: ${filename}`)
  }
}

// Check if file is HEIC/HEIF format
function isHeicFormat(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase()
  return ext.endsWith('.heic') || ext.endsWith('.heif') ||
         mimeType === 'image/heic' || mimeType === 'image/heif'
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Process image request received')
    const formData = await request.formData()
    const slug = formData.get('slug') as string
    const cropDataStr = formData.get('cropArea') as string | null
    const cropAreasStr = formData.get('cropAreas') as string | null
    const frameType = (formData.get('frameType') as string || 'single') as FrameType
    const backgroundColor = formData.get('backgroundColor') as string | null
    // 회전 정보
    const rotationStr = formData.get('rotation') as string | null
    const rotationsStr = formData.get('rotations') as string | null
    console.log('[API] Request params:', { slug, frameType, hasCropArea: !!cropDataStr, hasCropAreas: !!cropAreasStr, backgroundColor, rotation: rotationStr, rotations: rotationsStr })

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
      'landscape-single': 1,
      'landscape-two': 2,
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
          let buffer = Buffer.from(ab)
          console.log(`[API] Photo ${index + 1} buffer created:`, buffer.length, 'bytes')

          // Convert HEIC to JPEG if needed
          if (isHeicFormat(photo.name, photo.type)) {
            buffer = await convertHeicToJpeg(buffer, photo.name) as any
          }

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

      // Convert HEIC to JPEG if needed
      if (isHeicFormat(file.name, file.type)) {
        buffers = await convertHeicToJpeg(buffers, file.name) as any
      }
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

    // Parse rotation(s) if provided
    let rotation: number | number[] = 0
    console.log('[API] Raw rotation values - rotationStr:', rotationStr, 'rotationsStr:', rotationsStr)
    if (isMultiPhoto && rotationsStr) {
      try {
        rotation = JSON.parse(rotationsStr)
        console.log('[API] Rotations parsed (multi):', rotation)
      } catch (e) {
        console.error('[API] Failed to parse rotations:', e)
        rotation = Array(expectedCount).fill(0)
      }
    } else if (rotationStr) {
      rotation = parseInt(rotationStr, 10) || 0
      console.log('[API] Rotation parsed (single):', rotation)
    }
    console.log('[API] Final rotation value to processImage:', rotation)

    console.log('[API] Calling processImage...')
    const processedBuffer = await processImage(
      buffers,
      cropArea || undefined,
      frameType,
      backgroundColor || undefined,
      rotation
    )
    console.log('[API] Image processed successfully, buffer size:', processedBuffer.length, 'bytes')

    // In Vercel (serverless), return image as base64 data URL
    // In local development, save to public/uploads
    const isVercel = process.env.VERCEL === '1'
    console.log('[API] Preparing response:', { isVercel })

    if (isVercel) {
      // Convert buffer to base64 data URL
      const base64 = processedBuffer.toString('base64')
      const dataUrl = `data:image/jpeg;base64,${base64}`
      console.log('[API] Success! Returning data URL, size:', base64.length, 'chars')
      return NextResponse.json({ url: dataUrl })
    } else {
      // Save to local filesystem for development
      const timestamp = Date.now()
      const filename = `processed-${timestamp}.jpg`
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

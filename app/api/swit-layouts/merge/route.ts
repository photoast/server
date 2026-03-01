import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import memoryDB from '@/lib/memorydb'
import { saveUploadedFile } from '@/lib/image'
import type { SwitSlot } from '@/lib/types'

// Fetch a URL and return Buffer (handles /uploads/ relative paths and data URLs)
async function fetchBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    return Buffer.from(base64, 'base64')
  }
  if (url.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), 'public', url)
    return fs.readFileSync(filePath)
  }
  if (url.startsWith('/api/serve-image/')) {
    const filename = url.replace('/api/serve-image/', '')
    const filePath = path.join('/tmp/uploads', filename)
    return fs.readFileSync(filePath)
  }
  // Absolute URL
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const layoutId = formData.get('layoutId') as string

    if (!layoutId) {
      return NextResponse.json({ error: 'layoutId required' }, { status: 400 })
    }

    const layout = await memoryDB.getLayoutById(layoutId)
    if (!layout) {
      return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
    }

    const { canvasWidth, canvasHeight, slots, frameUrl } = layout

    // Collect per-slot adjustment data (pan/zoom from user)
    // Format: slot_{id}_photo = File, slot_{id}_offsetX = number, slot_{id}_offsetY = number, slot_{id}_scale = number
    const composites: sharp.OverlayOptions[] = []

    // Sort slots by order
    const sortedSlots = [...slots].sort((a, b) => a.order - b.order)

    for (const slot of sortedSlots) {
      const photoFile = formData.get(`slot_${slot.id}_photo`) as File | null
      if (!photoFile) continue

      const offsetX = parseFloat(formData.get(`slot_${slot.id}_offsetX`) as string || '0')
      const offsetY = parseFloat(formData.get(`slot_${slot.id}_offsetY`) as string || '0')
      const scale = parseFloat(formData.get(`slot_${slot.id}_scale`) as string || '1')

      const photoBuffer = Buffer.from(await photoFile.arrayBuffer())

      // Get original image dimensions
      const meta = await sharp(photoBuffer).metadata()
      const origW = meta.width!
      const origH = meta.height!

      // Apply scale: the user scaled the image by `scale` factor
      const scaledW = Math.round(origW * scale)
      const scaledH = Math.round(origH * scale)

      // Resize image to scaled dimensions
      const scaledBuffer = await sharp(photoBuffer)
        .resize(scaledW, scaledH, { fit: 'fill' })
        .toBuffer()

      // Extract the slot region from the scaled image
      // offsetX/Y are the pan offsets (in slot pixels) — how much the image is shifted
      // The slot viewport shows a slot.width × slot.height window into the scaled image
      // Image center is at (scaledW/2 + offsetX, scaledH/2 + offsetY)
      // Viewport center is at (slot.width/2, slot.height/2)
      // So: extract starts at image_center - slot_size/2
      const extractLeft = Math.max(0, Math.round(scaledW / 2 + offsetX - slot.width / 2))
      const extractTop = Math.max(0, Math.round(scaledH / 2 + offsetY - slot.height / 2))
      const extractWidth = Math.min(slot.width, scaledW - extractLeft)
      const extractHeight = Math.min(slot.height, scaledH - extractTop)

      let slotBuffer: Buffer
      if (extractWidth > 0 && extractHeight > 0) {
        slotBuffer = await sharp(scaledBuffer)
          .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
          .resize(slot.width, slot.height, { fit: 'fill' })
          .toBuffer()
      } else {
        // Fallback: center crop
        slotBuffer = await sharp(photoBuffer)
          .resize(slot.width, slot.height, { fit: 'cover', position: 'center' })
          .toBuffer()
      }

      composites.push({
        input: slotBuffer,
        left: Math.round(slot.x),
        top: Math.round(slot.y),
      })
    }

    // Add frame overlay on top (if exists)
    if (frameUrl) {
      try {
        const frameBuffer = await fetchBuffer(frameUrl)
        // Resize frame to canvas size
        const resizedFrame = await sharp(frameBuffer)
          .resize(canvasWidth, canvasHeight, { fit: 'fill' })
          .png()
          .toBuffer()
        composites.push({ input: resizedFrame, left: 0, top: 0 })
      } catch (err) {
        console.warn('Failed to load frame, skipping:', err)
      }
    }

    // Create white canvas and composite all layers
    const result = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer()

    // Save result
    const filename = `swit-merged-${layoutId}-${Date.now()}.jpg`
    const isVercel = process.env.VERCEL === '1'

    if (isVercel) {
      const base64 = result.toString('base64')
      return NextResponse.json({ url: `data:image/jpeg;base64,${base64}` })
    }

    const savedPath = path.join(process.cwd(), 'public', 'uploads', filename)
    fs.writeFileSync(savedPath, result)
    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err: any) {
    console.error('Merge error:', err)
    return NextResponse.json({ error: err.message || 'Merge failed' }, { status: 500 })
  }
}

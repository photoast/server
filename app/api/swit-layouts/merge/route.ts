import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { getLayoutById } from '@/lib/models'
import type { SwitFrameLayer } from '@/lib/types'

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

    const layout = await getLayoutById(layoutId)
    if (!layout) {
      return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
    }

    const { canvasWidth, canvasHeight, slots, frameLayers } = layout

    // Build unified composite items sorted by zIndex
    type CompositeItem =
      | { type: 'slot'; slotId: string; zIndex: number }
      | { type: 'frame'; layer: SwitFrameLayer; zIndex: number }

    const items: CompositeItem[] = []

    for (const slot of slots) {
      items.push({ type: 'slot', slotId: slot.id, zIndex: slot.zIndex ?? 10 })
    }

    // Use frameLayers (already normalized by memorydb)
    for (const layer of (frameLayers || [])) {
      if (!layer.visible) continue
      items.push({ type: 'frame', layer, zIndex: layer.zIndex })
    }

    // Sort by zIndex ascending (lower = behind)
    items.sort((a, b) => a.zIndex - b.zIndex)

    // Build composites in z-order
    const composites: sharp.OverlayOptions[] = []

    for (const item of items) {
      if (item.type === 'slot') {
        const slot = slots.find(s => s.id === item.slotId)!
        const photoFile = formData.get(`slot_${slot.id}_photo`) as File | null
        if (!photoFile) continue

        const photoBuffer = Buffer.from(await photoFile.arrayBuffer())
        const slotW = Math.round(slot.width)
        const slotH = Math.round(slot.height)

        // Use pixel crop area directly from react-easy-crop's onCropComplete
        const cropX = parseFloat(formData.get(`slot_${slot.id}_cropX`) as string || '')
        const cropY = parseFloat(formData.get(`slot_${slot.id}_cropY`) as string || '')
        const cropW = parseFloat(formData.get(`slot_${slot.id}_cropW`) as string || '')
        const cropH = parseFloat(formData.get(`slot_${slot.id}_cropH`) as string || '')

        let slotBuffer: Buffer
        if (cropW > 0 && cropH > 0 && !isNaN(cropX) && !isNaN(cropY)) {
          slotBuffer = await sharp(photoBuffer)
            .extract({
              left: Math.round(cropX),
              top: Math.round(cropY),
              width: Math.round(cropW),
              height: Math.round(cropH),
            })
            .resize(slotW, slotH, { fit: 'fill' })
            .toBuffer()
        } else {
          slotBuffer = await sharp(photoBuffer)
            .resize(slotW, slotH, { fit: 'cover', position: 'center' })
            .toBuffer()
        }

        const rotation = slot.rotation ?? 0

        if (rotation !== 0) {
          // Rotate around top-left: render the slot image onto a canvas-sized
          // transparent layer at the slot position, rotate the whole layer, then composite.
          // sharp.rotate() rotates around center, so we place the image on a full canvas
          // at the correct position, rotate the entire canvas, then composite.

          // Simpler approach: rotate the slot image, then calculate new bounding box position.
          // sharp.rotate(angle, { background: transparent }) expands to fit rotated image.
          const rotatedBuffer = await sharp(slotBuffer)
            .ensureAlpha()
            .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()

          // After rotation, the image is expanded. We need to position it so that
          // the rotation origin (top-left of original rect) is at (slot.x, slot.y).
          const rotMeta = await sharp(rotatedBuffer).metadata()
          const rotW = rotMeta.width!
          const rotH = rotMeta.height!

          // sharp.rotate rotates around center of the expanded bounding box.
          // The original top-left corner position after rotation:
          const rad = (rotation * Math.PI) / 180
          // Center of original image relative to its top-left
          const cx = slotW / 2
          const cy = slotH / 2
          // After rotation around (cx, cy), new bounding box center is at center of rotated image
          // The top-left of original was at (0,0). After rotating around center (cx,cy):
          // newX = cx + (0-cx)*cos - (0-cy)*sin = cx(1-cos) + cy*sin
          // newY = cy + (0-cx)*sin + (0-cy)*cos = cy(1-cos) - cx*sin  (wait, this is wrong)
          // Actually: rotating point (0,0) around (cx,cy) by angle:
          // newX = cx + (0-cx)*cos(a) - (0-cy)*sin(a) = cx - cx*cos(a) + cy*sin(a)
          // newY = cy + (0-cx)*sin(a) + (0-cy)*cos(a) = cy - cx*sin(a) - cy*cos(a)  (this is also wrong)
          // Let me just use: the offset from the center of rotated bounding box to the rotated origin point.
          // Sharp places the rotated image centered in the new bounding box.
          // Original top-left (0,0) in original image coords, relative to original center = (-cx, -cy)
          // After rotation: (-cx*cos + cy*sin, -cx*sin - cy*cos)  (standard rotation)
          // In rotated bounding box, center is at (rotW/2, rotH/2)
          // So the original top-left is now at:
          const origTLx = rotW / 2 + (-cx * Math.cos(rad) + cy * Math.sin(rad))
          const origTLy = rotH / 2 + (-cx * Math.sin(rad) - cy * Math.cos(rad))

          // We want the original top-left to be at (slot.x, slot.y) on the canvas
          const compositeLeft = Math.round(slot.x - origTLx)
          const compositeTop = Math.round(slot.y - origTLy)

          composites.push({
            input: rotatedBuffer,
            left: compositeLeft,
            top: compositeTop,
          })
        } else {
          composites.push({
            input: slotBuffer,
            left: Math.round(slot.x),
            top: Math.round(slot.y),
          })
        }
      } else {
        // Frame layer
        const layer = item.layer
        try {
          const frameBuffer = await fetchBuffer(layer.imageUrl)
          // SVG: use density for high-res rasterization
          const isSvg = layer.imageUrl.endsWith('.svg') || layer.imageUrl.includes('svg')
          const sharpOpts = isSvg ? { density: 300 } : {}

          const layerX = layer.x ?? 0
          const layerY = layer.y ?? 0
          const layerW = Math.round(layer.width ?? canvasWidth)
          const layerH = Math.round(layer.height ?? canvasHeight)
          const layerRot = layer.rotation ?? 0

          let resizedFrame = await sharp(frameBuffer, sharpOpts)
            .resize(layerW, layerH, { fit: 'fill' })
            .ensureAlpha()
            .png()
            .toBuffer()

          if (layerRot !== 0) {
            resizedFrame = await sharp(resizedFrame)
              .rotate(layerRot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .png()
              .toBuffer()
            const rotMeta = await sharp(resizedFrame).metadata()
            const rotW = rotMeta.width!
            const rotH = rotMeta.height!
            const rad = (layerRot * Math.PI) / 180
            const cx = layerW / 2, cy = layerH / 2
            const origTLx = rotW / 2 + (-cx * Math.cos(rad) + cy * Math.sin(rad))
            const origTLy = rotH / 2 + (-cx * Math.sin(rad) - cy * Math.cos(rad))
            composites.push({ input: resizedFrame, left: Math.round(layerX - origTLx), top: Math.round(layerY - origTLy) })
          } else {
            composites.push({ input: resizedFrame, left: Math.round(layerX), top: Math.round(layerY) })
          }
        } catch (err) {
          console.warn(`Failed to load frame layer ${layer.id}, skipping:`, err)
        }
      }
    }

    // Parse background color (hex → RGB)
    const bgColorHex = (formData.get('backgroundColor') as string) || '#FFFFFF'
    const bgR = parseInt(bgColorHex.slice(1, 3), 16) || 255
    const bgG = parseInt(bgColorHex.slice(3, 5), 16) || 255
    const bgB = parseInt(bgColorHex.slice(5, 7), 16) || 255

    // Create canvas with background color and composite all layers
    const result = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: bgR, g: bgG, b: bgB },
      },
    })
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer()

    // Save result to Blob
    const filename = `swit-merged-${layoutId}-${Date.now()}.jpg`
    const { uploadToBlob } = await import('@/lib/blob')
    const url = await uploadToBlob(filename, result)
    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Merge error:', err)
    return NextResponse.json({ error: err.message || 'Merge failed' }, { status: 500 })
  }
}

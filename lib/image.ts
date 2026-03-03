import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { FrameType } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, LAYOUT_CONFIG, FOUR_CUT_CONFIG } from './layoutConstants'

// Standard print sizes at 300 DPI (4x6 inch)
const TARGET_WIDTH = CANVAS_WIDTH    // 4 inch * 300 DPI
const TARGET_HEIGHT = CANVAS_HEIGHT   // 6 inch * 300 DPI

// All layouts use standard 4x6 inch paper
// Life Four-Cut will fit 4 photos vertically within this size

export interface CropArea {
  x: number      // pixels from left
  y: number      // pixels from top
  width: number  // pixels
  height: number // pixels
}

// Check if frame type is landscape (6x4 instead of 4x6)
function isLandscapeLayout(frameType: FrameType): boolean {
  return frameType === 'landscape-single' || frameType === 'landscape-two'
}

export async function processImage(
  inputBuffer: Buffer | Buffer[],
  cropArea?: CropArea | CropArea[],
  frameType: FrameType = 'single',
  backgroundColor?: string,
  rotation?: number | number[]
): Promise<Buffer> {
  // Determine canvas dimensions based on frame type
  const isLandscape = isLandscapeLayout(frameType)
  const canvasWidth = isLandscape ? CANVAS_HEIGHT : CANVAS_WIDTH   // landscape: 1800, portrait: 1200
  const canvasHeight = isLandscape ? CANVAS_WIDTH : CANVAS_HEIGHT  // landscape: 1200, portrait: 1800

  console.log(`Frame type: ${frameType}, isLandscape: ${isLandscape}, dimensions: ${canvasWidth}x${canvasHeight}`)

  // Handle multi-photo layouts
  if (frameType === 'four-cut') {
    return processFourCutImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor,
      rotation as number[]
    )
  }

  if (frameType === 'two-by-two') {
    return processTwoByTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor,
      rotation as number[]
    )
  }

  if (frameType === 'vertical-two') {
    return processVerticalTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor,
      rotation as number[]
    )
  }

  if (frameType === 'one-plus-two') {
    return processOnePlusTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor,
      rotation as number[]
    )
  }

  // Handle landscape-two (6x4 with 2 photos side by side)
  if (frameType === 'landscape-two') {
    return processLandscapeTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor,
      rotation as number[]
    )
  }

  // Handle landscape-single (6x4 single photo)
  if (frameType === 'landscape-single') {
    const singleBuffer = Array.isArray(inputBuffer) ? inputBuffer[0] : inputBuffer
    const singleCropArea = Array.isArray(cropArea) ? cropArea[0] : cropArea
    const singleRotation = Array.isArray(rotation) ? rotation[0] : (rotation || 0)
    return processSingleImage(singleBuffer, singleCropArea, singleRotation, true)
  }

  // Handle single frame (4x6 portrait)
  const singleBuffer = Array.isArray(inputBuffer) ? inputBuffer[0] : inputBuffer
  const singleCropArea = Array.isArray(cropArea) ? cropArea[0] : cropArea
  const singleRotation = Array.isArray(rotation) ? rotation[0] : (rotation || 0)
  return processSingleImage(singleBuffer, singleCropArea, singleRotation, false)
}

async function processSingleImage(
  inputBuffer: Buffer,
  cropArea?: CropArea,
  rotation: number = 0,
  isLandscape: boolean = false
): Promise<Buffer> {
  // Determine canvas dimensions based on layout type
  const outputWidth = isLandscape ? CANVAS_HEIGHT : CANVAS_WIDTH   // landscape: 1800, portrait: 1200
  const outputHeight = isLandscape ? CANVAS_WIDTH : CANVAS_HEIGHT  // landscape: 1200, portrait: 1800

  // Photo takes up full canvas
  const photoHeight = outputHeight

  console.log(`Single image layout: ${isLandscape ? 'landscape' : 'portrait'} mode, canvas ${outputWidth}x${outputHeight}, Photo area 100% (${photoHeight}px), Rotation: ${rotation}°`)

  // Get original image metadata BEFORE any rotation
  const originalMetadata = await sharp(inputBuffer).metadata()
  console.log(`Original image (raw): ${originalMetadata.width}x${originalMetadata.height}, EXIF orientation: ${originalMetadata.orientation}`)

  // Step 1: Apply EXIF auto-rotation only first
  const exifRotatedBuffer = await sharp(inputBuffer).rotate().toBuffer()
  const afterExifMetadata = await sharp(exifRotatedBuffer).metadata()
  console.log(`After EXIF auto-rotation: ${afterExifMetadata.width}x${afterExifMetadata.height}`)

  // Step 2: Apply user rotation if provided (90, 180, 270)
  let rotatedBuffer = exifRotatedBuffer
  if (rotation !== 0) {
    console.log(`Applying user rotation: ${rotation}°`)
    rotatedBuffer = await sharp(exifRotatedBuffer).rotate(rotation).toBuffer()
  }

  // Now create a new sharp instance from the rotated buffer
  let image = sharp(rotatedBuffer)

  // Get dimensions of the rotated image
  const metadata = await image.metadata()
  let originalWidth = metadata.width || 0
  let originalHeight = metadata.height || 0

  console.log(`Image after user rotation: ${originalWidth}x${originalHeight}`)

  // Apply crop if provided
  let hasCrop = false
  if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
    console.log(`Requested crop: ${cropArea.width}x${cropArea.height} at (${cropArea.x}, ${cropArea.y})`)

    // Clamp crop area to image boundaries
    const left = Math.max(0, Math.min(Math.round(cropArea.x), originalWidth - 1))
    const top = Math.max(0, Math.min(Math.round(cropArea.y), originalHeight - 1))
    const width = Math.min(Math.round(cropArea.width), originalWidth - left)
    const height = Math.min(Math.round(cropArea.height), originalHeight - top)

    // Ensure we have valid dimensions
    if (width > 0 && height > 0) {
      console.log(`Actual crop: ${width}x${height} at (${left}, ${top})`)

      image = image.extract({
        left,
        top,
        width,
        height,
      })
      hasCrop = true
    } else {
      console.warn('Invalid crop area, skipping crop')
    }
  }

  // Resize photo to fit the photo area (top portion)
  // If crop was applied, the aspect ratio should match, so use 'fill'
  // If no crop, use 'cover' to maintain aspect ratio and fill the space
  const photoBuffer = await image
    .resize(outputWidth, photoHeight, {
      fit: hasCrop ? 'fill' : 'cover',
      position: 'centre',
    })
    .toBuffer()

  console.log(`Target size: ${outputWidth}x${outputHeight} (${isLandscape ? '6x4' : '4x6'} inch @ 300 DPI)`)

  // Create a blank canvas for the final image with white background
  let finalImage = sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })

  // Composite photo onto canvas
  finalImage = finalImage.composite([{
    input: photoBuffer,
    top: 0,
    left: 0,
  }])

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4' // Best quality
  }).toBuffer()
}

async function processFourCutImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string,
  rotations?: number[]
): Promise<Buffer> {
  // Ensure we have exactly 4 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 4) {
    throw new Error('Four-cut frame requires exactly 4 images')
  }

  // Life Four-Cut (네컷) specifications within 4x6 inch paper
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Layout: 2 identical vertical strips side by side (for cutting in half)
  // - Each strip: 4 photos vertically
  // - Gap between photos: configurable
  // - Gap between strips: configurable
  // - Outer margins: configurable
  // - Background: Customizable (default black)

  const { MARGIN_OUTER, GAP_CENTER, GAP_BETWEEN_PHOTOS } = FOUR_CUT_CONFIG

  // Calculate strip dimensions
  const stripWidth = Math.round((TARGET_WIDTH - (MARGIN_OUTER * 2) - GAP_CENTER) / 2)  // ~485px each strip
  const stripHeight = TARGET_HEIGHT - (MARGIN_OUTER * 2)  // 1460px

  // Calculate photo dimensions within each strip
  const photoWidth = stripWidth  // fills strip width
  const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3
  const photoHeight = Math.round((stripHeight - totalGapsHeight) / 4)  // ~357px

  console.log(`Life Four-Cut Dual Strip layout: 2 strips × 4 photos each`)
  console.log(`Strip size: ${stripWidth}x${stripHeight}px, Photo size: ${photoWidth}x${photoHeight}px`)
  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px (4x6 inch)`)
  console.log(`Background color: ${backgroundColor || 'black'}`)
  console.log(`Rotations: ${rotations || 'none'}`)

  // Process each of the 4 photos
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation = rotations?.[i] || 0
    let tempImage = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    if (rotation !== 0) {
      console.log(`Photo ${i + 1} applying rotation: ${rotation}°`)
      tempImage = tempImage.rotate(rotation)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Get metadata after rotation
    const metadata = await image.metadata()
    let originalWidth = metadata.width || 0
    let originalHeight = metadata.height || 0

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      console.log(`Photo ${i + 1} original: ${originalWidth}x${originalHeight}`)
      console.log(`Photo ${i + 1} crop requested: ${cropAreas[i].width}x${cropAreas[i].height} at (${cropAreas[i].x}, ${cropAreas[i].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[i].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[i].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[i].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[i].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Photo ${i + 1} crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    // If crop was applied, the aspect ratio should match, so use 'fill'
    // If no crop, use 'cover' to maintain aspect ratio and fill the space
    const hasCrop = cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0
    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: hasCrop ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#FFFFFF'
  const rgb = hexToRgb(bgColor)

  // Create blank canvas with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b }
    }
  })

  const composites: any[] = []

  // Add 4 photos to LEFT strip
  for (let i = 0; i < 4; i++) {
    const topPosition = MARGIN_OUTER + (i * (photoHeight + GAP_BETWEEN_PHOTOS))
    const leftPosition = MARGIN_OUTER

    composites.push({
      input: photoBuffers[i],
      top: topPosition,
      left: leftPosition,
    })
  }

  // Add 4 photos to RIGHT strip (identical to left)
  for (let i = 0; i < 4; i++) {
    const topPosition = MARGIN_OUTER + (i * (photoHeight + GAP_BETWEEN_PHOTOS))
    const rightPosition = MARGIN_OUTER + stripWidth + GAP_CENTER

    composites.push({
      input: photoBuffers[i],
      top: topPosition,
      left: rightPosition,
    })
  }

  console.log(`Composed ${composites.length} photos (2 identical strips of 4 photos each)`)

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4'
  }).toBuffer()
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Parse hex values
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

  return { r, g, b }
}

async function processTwoByTwoImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string,
  rotations?: number[]
): Promise<Buffer> {
  // Ensure we have exactly 4 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 4) {
    throw new Error('Two-by-two frame requires exactly 4 images')
  }

  // Two-by-two layout specifications (2x2 grid)
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Photo count: 4 (2 rows × 2 columns)
  // - Gap between photos: configurable
  // - Left/Right margin: configurable
  // - Top/Bottom margin: configurable
  // - Background: Customizable (default black)

  const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = TARGET_HEIGHT

  console.log(`Two-by-Two layout: Photo area 100% (${photoAreaHeight}px)`)
  console.log(`Rotations: ${rotations || 'none'}`)

  // Calculate available space within photo area
  const availableWidth = TARGET_WIDTH - (MARGIN_HORIZONTAL * 2)
  const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)

  // Calculate photo dimensions (2x2 grid)
  const photoWidth = Math.round((availableWidth - GAP) / 2)  // 450px
  const photoHeight = Math.round((availableHeight - GAP) / 2) // 680px

  console.log(`Two-by-Two: 4 photos @ ${photoWidth}x${photoHeight}px each (2x2 grid)`)
  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px`)
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px, Gap=${GAP}px`)

  // Process each of the 4 photos
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation = rotations?.[i] || 0
    let tempImage = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    if (rotation !== 0) {
      console.log(`Photo ${i + 1} applying rotation: ${rotation}°`)
      tempImage = tempImage.rotate(rotation)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Get metadata after rotation
    const metadata = await image.metadata()
    let originalWidth = metadata.width || 0
    let originalHeight = metadata.height || 0

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      console.log(`Photo ${i + 1} original: ${originalWidth}x${originalHeight}`)
      console.log(`Photo ${i + 1} crop requested: ${cropAreas[i].width}x${cropAreas[i].height} at (${cropAreas[i].x}, ${cropAreas[i].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[i].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[i].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[i].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[i].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Photo ${i + 1} crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    // If crop was applied, the aspect ratio should match, so use 'fill'
    // If no crop, use 'cover' to maintain aspect ratio and fill the space
    const hasCrop = cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0
    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: hasCrop ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#FFFFFF'
  const rgb = hexToRgb(bgColor)

  // Create blank canvas with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b }
    }
  })

  const composites: any[] = []

  // Add 4 photos in 2x2 grid
  // Layout:
  // [0] [1]
  // [2] [3]
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2)  // 0 or 1
    const col = i % 2              // 0 or 1

    const left = MARGIN_HORIZONTAL + (col * (photoWidth + GAP))
    const top = MARGIN_VERTICAL + (row * (photoHeight + GAP))

    composites.push({
      input: photoBuffers[i],
      top,
      left,
    })

    console.log(`Photo ${i + 1} positioned at (${left}, ${top})`)
  }

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4'
  }).toBuffer()
}

async function processVerticalTwoImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string,
  rotations?: number[]
): Promise<Buffer> {
  // Ensure we have exactly 2 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 2) {
    throw new Error('Vertical-two frame requires exactly 2 images')
  }

  // Vertical-two layout specifications (1×2 vertical stack)
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Photo count: 2 (stacked vertically)
  // - Gap between photos: configurable
  // - Horizontal margin: configurable
  // - Vertical margin: configurable
  // - Background: Customizable (default black)

  const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = TARGET_HEIGHT

  console.log(`Vertical-Two layout: Photo area 100% (${photoAreaHeight}px)`)
  console.log(`Rotations: ${rotations || 'none'}`)

  // Calculate available space within photo area
  const availableWidth = TARGET_WIDTH - (MARGIN_HORIZONTAL * 2)   // 920px
  const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)

  // Calculate photo dimensions (2 photos stacked vertically)
  const photoWidth = availableWidth                              // 920px
  const photoHeight = Math.round((availableHeight - GAP) / 2)   // 680px each

  console.log(`Vertical-Two: 2 photos @ ${photoWidth}x${photoHeight}px each (vertical stack)`)
  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px`)
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px, Gap=${GAP}px`)

  // Process each of the 2 photos
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 2; i++) {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation = rotations?.[i] || 0
    let tempImage = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    if (rotation !== 0) {
      console.log(`Photo ${i + 1} applying rotation: ${rotation}°`)
      tempImage = tempImage.rotate(rotation)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Get metadata after rotation
    const metadata = await image.metadata()
    let originalWidth = metadata.width || 0
    let originalHeight = metadata.height || 0

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      console.log(`Photo ${i + 1} original: ${originalWidth}x${originalHeight}`)
      console.log(`Photo ${i + 1} crop requested: ${cropAreas[i].width}x${cropAreas[i].height} at (${cropAreas[i].x}, ${cropAreas[i].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[i].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[i].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[i].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[i].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Photo ${i + 1} crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    // If crop was applied, the aspect ratio should match, so use 'fill'
    // If no crop, use 'cover' to maintain aspect ratio and fill the space
    const hasCrop = cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0
    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: hasCrop ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#FFFFFF'
  const rgb = hexToRgb(bgColor)

  // Create blank canvas with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b }
    }
  })

  const composites: any[] = []

  // Add 2 photos vertically
  // Layout:
  // [0]
  // [1]
  for (let i = 0; i < 2; i++) {
    const left = MARGIN_HORIZONTAL
    const top = MARGIN_VERTICAL + (i * (photoHeight + GAP))

    composites.push({
      input: photoBuffers[i],
      top,
      left,
    })

    console.log(`Photo ${i + 1} positioned at (${left}, ${top})`)
  }

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4'
  }).toBuffer()
}

async function processOnePlusTwoImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string,
  rotations?: number[]
): Promise<Buffer> {
  // Ensure we have exactly 3 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 3) {
    throw new Error('One-plus-two frame requires exactly 3 images')
  }

  // One-plus-two layout specifications (1 large on top, 2 small below)
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Photo count: 3 (1 large top, 2 small bottom)
  // - Gap between photos: configurable
  // - Horizontal margin: configurable
  // - Vertical margin: configurable
  // - Background: Customizable (default black)

  const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = TARGET_HEIGHT

  console.log(`One-Plus-Two layout: Photo area 100% (${photoAreaHeight}px)`)
  console.log(`Rotations: ${rotations || 'none'}`)

  // Calculate available space within photo area
  const availableWidth = TARGET_WIDTH - (MARGIN_HORIZONTAL * 2)   // 920px
  const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)

  // Calculate photo dimensions
  // Top photo: Full width, half height minus gap
  const topPhotoWidth = availableWidth                            // 920px
  const topPhotoHeight = Math.round((availableHeight - GAP) / 2) // 680px

  // Bottom photos: Half width each, same height as top
  const bottomPhotoWidth = Math.round((availableWidth - GAP) / 2) // 450px each
  const bottomPhotoHeight = topPhotoHeight                         // 680px

  console.log(`One-Plus-Two layout: 1 large photo @ ${topPhotoWidth}x${topPhotoHeight}px, 2 small photos @ ${bottomPhotoWidth}x${bottomPhotoHeight}px`)
  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px`)
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px, Gap=${GAP}px`)

  // Process all 3 photos
  const photoBuffers: Buffer[] = []

  // Process top photo (index 0)
  {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation0 = rotations?.[0] || 0
    let tempImage = sharp(inputBuffers[0]).rotate() // Auto-rotate based on EXIF

    if (rotation0 !== 0) {
      console.log(`Top photo applying rotation: ${rotation0}°`)
      tempImage = tempImage.rotate(rotation0)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Apply crop if provided
    if (cropAreas && cropAreas[0] && cropAreas[0].width > 0 && cropAreas[0].height > 0) {
      const metadata = await image.metadata()
      let originalWidth = metadata.width || 0
      let originalHeight = metadata.height || 0

      console.log(`Top photo original: ${originalWidth}x${originalHeight}`)
      console.log(`Top photo crop requested: ${cropAreas[0].width}x${cropAreas[0].height} at (${cropAreas[0].x}, ${cropAreas[0].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[0].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[0].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[0].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[0].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Top photo crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    // If crop was applied, the aspect ratio should match, so use 'fill'
    // If no crop, use 'cover' to maintain aspect ratio and fill the space
    const hasCrop0 = cropAreas && cropAreas[0] && cropAreas[0].width > 0 && cropAreas[0].height > 0
    const processedPhoto = await image
      .resize(topPhotoWidth, topPhotoHeight, {
        fit: hasCrop0 ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Process bottom 2 photos (index 1, 2)
  for (let i = 1; i < 3; i++) {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation = rotations?.[i] || 0
    let tempImage = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    if (rotation !== 0) {
      console.log(`Bottom photo ${i} applying rotation: ${rotation}°`)
      tempImage = tempImage.rotate(rotation)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      const metadata = await image.metadata()
      let originalWidth = metadata.width || 0
      let originalHeight = metadata.height || 0

      console.log(`Bottom photo ${i} original: ${originalWidth}x${originalHeight}`)
      console.log(`Bottom photo ${i} crop requested: ${cropAreas[i].width}x${cropAreas[i].height} at (${cropAreas[i].x}, ${cropAreas[i].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[i].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[i].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[i].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[i].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Bottom photo ${i} crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    // If crop was applied, the aspect ratio should match, so use 'fill'
    // If no crop, use 'cover' to maintain aspect ratio and fill the space
    const hasCrop = cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0
    const processedPhoto = await image
      .resize(bottomPhotoWidth, bottomPhotoHeight, {
        fit: hasCrop ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#FFFFFF'
  const rgb = hexToRgb(bgColor)

  // Create blank canvas with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b }
    }
  })

  const composites: any[] = []

  // Add top photo (index 0)
  composites.push({
    input: photoBuffers[0],
    top: MARGIN_VERTICAL,
    left: MARGIN_HORIZONTAL,
  })
  console.log(`Top photo positioned at (${MARGIN_HORIZONTAL}, ${MARGIN_VERTICAL})`)

  // Add bottom 2 photos (index 1, 2)
  // Layout:
  //   [0]
  // [1] [2]
  for (let i = 1; i < 3; i++) {
    const col = i - 1  // 0 or 1
    const left = MARGIN_HORIZONTAL + (col * (bottomPhotoWidth + GAP))
    const top = MARGIN_VERTICAL + topPhotoHeight + GAP

    composites.push({
      input: photoBuffers[i],
      top,
      left,
    })

    console.log(`Bottom photo ${i} positioned at (${left}, ${top})`)
  }

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4'
  }).toBuffer()
}

// Process 6x4 landscape with 2 photos side by side (2x1 grid)
async function processLandscapeTwoImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string,
  rotations?: number[]
): Promise<Buffer> {
  // 6x4 landscape canvas dimensions (swapped from 4x6)
  const LANDSCAPE_WIDTH = CANVAS_HEIGHT  // 1800
  const LANDSCAPE_HEIGHT = CANVAS_WIDTH  // 1200

  const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG

  // Available space for photos
  const availableWidth = LANDSCAPE_WIDTH - (MARGIN_HORIZONTAL * 2)
  const availableHeight = LANDSCAPE_HEIGHT - (MARGIN_VERTICAL * 2)

  // 2 photos side by side with gap
  const photoWidth = Math.round((availableWidth - GAP) / 2)
  const photoHeight = availableHeight

  console.log(`Landscape Two layout: canvas ${LANDSCAPE_WIDTH}x${LANDSCAPE_HEIGHT}, photo ${photoWidth}x${photoHeight}`)

  // Create canvas with background color
  const bgColor = backgroundColor || '#FFFFFF'
  let finalImage = sharp({
    create: {
      width: LANDSCAPE_WIDTH,
      height: LANDSCAPE_HEIGHT,
      channels: 3,
      background: bgColor
    }
  })

  // Process each photo
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 2; i++) {
    // Apply EXIF auto-rotation and user rotation first, then commit to buffer
    const rotation = rotations?.[i] || 0
    let tempImage = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    if (rotation !== 0) {
      console.log(`Landscape two photo ${i} applying rotation: ${rotation}°`)
      tempImage = tempImage.rotate(rotation)
    }

    // Commit rotations to buffer
    const rotatedBuffer = await tempImage.toBuffer()
    let image = sharp(rotatedBuffer)

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      const metadata = await image.metadata()
      let originalWidth = metadata.width || 0
      let originalHeight = metadata.height || 0

      console.log(`Landscape two photo ${i} original: ${originalWidth}x${originalHeight}`)
      console.log(`Landscape two photo ${i} crop requested: ${cropAreas[i].width}x${cropAreas[i].height} at (${cropAreas[i].x}, ${cropAreas[i].y})`)

      // Clamp crop area to image boundaries
      const left = Math.max(0, Math.min(Math.round(cropAreas[i].x), originalWidth - 1))
      const top = Math.max(0, Math.min(Math.round(cropAreas[i].y), originalHeight - 1))
      const width = Math.min(Math.round(cropAreas[i].width), originalWidth - left)
      const height = Math.min(Math.round(cropAreas[i].height), originalHeight - top)

      if (width > 0 && height > 0) {
        console.log(`Landscape two photo ${i} crop applied: ${width}x${height} at (${left}, ${top})`)
        image = image.extract({ left, top, width, height })
      }
    }

    // Resize to target dimensions
    const hasCrop = cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0
    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: hasCrop ? 'fill' : 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Composite photos onto canvas
  const composites: any[] = []

  for (let i = 0; i < 2; i++) {
    const left = MARGIN_HORIZONTAL + (i * (photoWidth + GAP))
    const top = MARGIN_VERTICAL

    composites.push({
      input: photoBuffers[i],
      top,
      left,
    })

    console.log(`Landscape two photo ${i} positioned at (${left}, ${top})`)
  }

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4'
  }).toBuffer()
}

export async function saveUploadedFile(
  file: File,
  filename: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const { uploadToBlob } = await import('./blob')
  return uploadToBlob(filename, buffer)
}

import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { LogoSettings, FrameType } from './types'

// Standard print sizes at 300 DPI (4x6 inch)
const TARGET_WIDTH = 1000    // 4 inch * 300 DPI
const TARGET_HEIGHT = 1500   // 6 inch * 300 DPI

// All layouts use standard 4x6 inch paper
// Life Four-Cut will fit 4 photos vertically within this size

const DEFAULT_PHOTO_RATIO = 85 // Default photo area is 85%

export interface CropArea {
  x: number      // pixels from left
  y: number      // pixels from top
  width: number  // pixels
  height: number // pixels
}

export async function processImage(
  inputBuffer: Buffer | Buffer[],
  logoPath?: string,
  cropArea?: CropArea | CropArea[],
  photoAreaRatio: number = DEFAULT_PHOTO_RATIO,
  logoSettings?: LogoSettings,
  frameType: FrameType = 'single',
  backgroundColor?: string
): Promise<Buffer> {
  // Handle four-cut frame
  if (frameType === 'four-cut') {
    return processFourCutImage(
      inputBuffer as Buffer[],
      logoPath,
      photoAreaRatio,
      logoSettings,
      cropArea as CropArea[],
      backgroundColor
    )
  }

  // Handle two-by-two frame
  if (frameType === 'two-by-two') {
    return processTwoByTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor
    )
  }

  // Handle single frame (existing logic)
  const singleBuffer = Array.isArray(inputBuffer) ? inputBuffer[0] : inputBuffer
  const singleCropArea = Array.isArray(cropArea) ? cropArea[0] : cropArea
  // Validate and clamp photo area ratio
  const ratio = Math.max(0, Math.min(100, photoAreaRatio))
  const photoHeight = Math.round(TARGET_HEIGHT * (ratio / 100))
  const logoHeight = TARGET_HEIGHT - photoHeight

  console.log(`Image layout: Photo area ${ratio}% (${photoHeight}px), Logo area ${100-ratio}% (${logoHeight}px)`)

  let image = sharp(singleBuffer)
    .rotate() // Auto-rotate based on EXIF orientation

  // Get original image metadata
  const metadata = await image.metadata()
  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0

  console.log(`Original image: ${originalWidth}x${originalHeight}`)

  // Apply crop if provided
  if (singleCropArea && singleCropArea.width > 0 && singleCropArea.height > 0) {
    console.log(`Requested crop: ${singleCropArea.width}x${singleCropArea.height} at (${singleCropArea.x}, ${singleCropArea.y})`)

    // Clamp crop area to image boundaries
    const left = Math.max(0, Math.min(Math.round(singleCropArea.x), originalWidth - 1))
    const top = Math.max(0, Math.min(Math.round(singleCropArea.y), originalHeight - 1))
    const width = Math.min(Math.round(singleCropArea.width), originalWidth - left)
    const height = Math.min(Math.round(singleCropArea.height), originalHeight - top)

    // Ensure we have valid dimensions
    if (width > 0 && height > 0) {
      console.log(`Actual crop: ${width}x${height} at (${left}, ${top})`)

      image = image.extract({
        left,
        top,
        width,
        height,
      })
    } else {
      console.warn('Invalid crop area, skipping crop')
    }
  }

  // Resize photo to fit the photo area (top portion)
  const photoBuffer = await image
    .resize(TARGET_WIDTH, photoHeight, {
      fit: 'cover',
      position: 'centre',
    })
    .toBuffer()

  console.log(`Target size: ${TARGET_WIDTH}x${TARGET_HEIGHT} (4x6 inch @ 300 DPI)`)

  // Parse background color (default black)
  const bgColor = backgroundColor || '#000000'
  const rgb = hexToRgb(bgColor)

  // Create a blank canvas for the final image with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b }
    }
  })

  const composites: any[] = []

  // If logo exists, add it FIRST (lower z-index)
  if (logoPath && logoHeight > 0) {
    try {
      // Convert URL to file path
      let logoFullPath: string

      if (logoPath.startsWith('/api/serve-image/')) {
        // Vercel: /api/serve-image/filename → /tmp/uploads/filename
        const filename = logoPath.replace('/api/serve-image/', '')
        logoFullPath = path.join('/tmp/uploads', filename)
      } else if (logoPath.startsWith('/uploads/')) {
        // Local: /uploads/filename → public/uploads/filename
        logoFullPath = path.join(process.cwd(), 'public', logoPath)
      } else if (logoPath.startsWith('/tmp')) {
        // Legacy absolute path (Vercel)
        logoFullPath = logoPath
      } else {
        // Relative path (local)
        logoFullPath = path.join(process.cwd(), 'public', logoPath)
      }

      const logoExists = await fs.access(logoFullPath).then(() => true).catch(() => false)

      if (logoExists) {
        // Get logo settings or use defaults
        const position = logoSettings?.position || 'bottom-center'
        const sizePercent = logoSettings?.size || 80 // Default 80% of image width

        // Calculate logo size based on settings (percentage of TOTAL image width, not logo area)
        const targetLogoWidth = Math.round(TARGET_WIDTH * (sizePercent / 100))

        // Resize logo based on width only, height will scale proportionally
        const logoBuffer = await sharp(logoFullPath)
          .resize(targetLogoWidth, null, {
            fit: 'inside',
            withoutEnlargement: false, // Allow enlargement beyond original size
          })
          .toBuffer()

        const logoMetadata = await sharp(logoBuffer).metadata()
        const logoWidth = logoMetadata.width || 0
        const actualLogoHeight = logoMetadata.height || 0

        // Calculate position based on settings
        let left = 0
        let top = photoHeight

        if (position === 'custom' && logoSettings?.x !== undefined && logoSettings?.y !== undefined) {
          // Use custom position (percentage of logo area)
          // Position is center-based, so we need to offset by half the logo size
          const centerX = Math.round((logoSettings.x / 100) * TARGET_WIDTH)
          const centerY = photoHeight + Math.round((logoSettings.y / 100) * logoHeight)

          left = centerX - Math.round(logoWidth / 2)
          top = centerY - Math.round(actualLogoHeight / 2)
        } else {
          // Parse position string
          const [vertical, horizontal] = position.split('-')

          // Calculate horizontal position
          if (horizontal === 'left') {
            left = 20 // Left padding
          } else if (horizontal === 'center') {
            left = Math.round((TARGET_WIDTH - logoWidth) / 2)
          } else if (horizontal === 'right') {
            left = TARGET_WIDTH - logoWidth - 20 // Right padding
          }

          // Calculate vertical position within logo area
          if (vertical === 'top') {
            top = photoHeight + 20 // Top of logo area with padding
          } else if (vertical === 'center') {
            top = photoHeight + Math.round((logoHeight - actualLogoHeight) / 2)
          } else if (vertical === 'bottom') {
            top = TARGET_HEIGHT - actualLogoHeight - 20 // Bottom with padding
          }
        }

        composites.push({
          input: logoBuffer,
          top,
          left,
        })

        console.log(`Logo positioned at (${left}, ${top}), size: ${logoWidth}x${actualLogoHeight}, position: ${position}, sizePercent: ${sizePercent}%`)
      }
    } catch (error) {
      console.error('Error adding logo:', error)
      // Continue without logo if there's an error
    }
  }

  // Add photo LAST (higher z-index) so it covers any logo that extends into photo area
  composites.push({
    input: photoBuffer,
    top: 0,
    left: 0,
  })

  finalImage = finalImage.composite(composites)

  return finalImage.jpeg({
    quality: 95,
    chromaSubsampling: '4:4:4' // Best quality
  }).toBuffer()
}

async function processFourCutImage(
  inputBuffers: Buffer[],
  logoPath?: string,
  photoAreaRatio: number = DEFAULT_PHOTO_RATIO,
  logoSettings?: LogoSettings,
  cropAreas?: CropArea[],
  backgroundColor?: string
): Promise<Buffer> {
  // Ensure we have exactly 4 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 4) {
    throw new Error('Four-cut frame requires exactly 4 images')
  }

  // Life Four-Cut (인생네컷) specifications within 4x6 inch paper
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Layout: 2 identical vertical strips side by side (for cutting in half)
  // - Each strip: 4 photos vertically
  // - Gap between photos: 10px
  // - Gap between strips: 10px (center)
  // - Outer margins: 20px
  // - Background: Customizable (default black)

  const MARGIN_OUTER = 20       // Outer margin (left, right, top, bottom)
  const GAP_CENTER = 10         // Gap between two strips
  const GAP_BETWEEN_PHOTOS = 10 // Gap between photos within a strip

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

  // Process each of the 4 photos
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    let image = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      const metadata = await image.metadata()
      const originalWidth = metadata.width || 0
      const originalHeight = metadata.height || 0

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

    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#000000'
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
  backgroundColor?: string
): Promise<Buffer> {
  // Ensure we have exactly 4 images
  if (!Array.isArray(inputBuffers) || inputBuffers.length !== 4) {
    throw new Error('Two-by-two frame requires exactly 4 images')
  }

  // Two-by-two layout specifications (2x2 grid)
  // - Total size: 1000×1500px (4x6 inch @ 300 DPI)
  // - Photo count: 4 (2 rows × 2 columns)
  // - Gap between photos: 20px
  // - Left/Right margin: 40px
  // - Top/Bottom margin: 60px
  // - Background: Customizable (default black)

  const MARGIN_HORIZONTAL = 40  // Left/Right margin
  const MARGIN_VERTICAL = 60    // Top/Bottom margin
  const GAP = 20                // Gap between photos

  // Calculate available space
  const availableWidth = TARGET_WIDTH - (MARGIN_HORIZONTAL * 2)
  const availableHeight = TARGET_HEIGHT - (MARGIN_VERTICAL * 2)

  // Calculate photo dimensions (2x2 grid)
  const photoWidth = Math.round((availableWidth - GAP) / 2)  // 450px
  const photoHeight = Math.round((availableHeight - GAP) / 2) // 680px

  console.log(`Two-by-Two layout: 4 photos @ ${photoWidth}x${photoHeight}px each (2x2 grid)`)
  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px, White background`)
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px, Gap=${GAP}px`)

  // Process each of the 4 photos
  const photoBuffers: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    let image = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      const metadata = await image.metadata()
      const originalWidth = metadata.width || 0
      const originalHeight = metadata.height || 0

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

    const processedPhoto = await image
      .resize(photoWidth, photoHeight, {
        fit: 'cover',
        position: 'centre',
      })
      .toBuffer()

    photoBuffers.push(processedPhoto)
  }

  // Parse background color (default black)
  const bgColor = backgroundColor || '#000000'
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

export async function saveUploadedFile(
  file: File,
  filename: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  // In Vercel (serverless), use /tmp directory (temporary, cleared on function restart)
  // In local development, use public/uploads (persistent)
  const isVercel = process.env.VERCEL === '1'

  if (isVercel) {
    // Vercel: Use /tmp directory (writable but temporary)
    const uploadDir = '/tmp/uploads'
    await fs.mkdir(uploadDir, { recursive: true })
    const filepath = path.join(uploadDir, filename)
    await fs.writeFile(filepath, buffer)

    console.warn('⚠️ File saved to /tmp (temporary). Consider using Vercel Blob Storage for production.')
    return `/api/serve-image/${filename}` // Return API route URL
  } else {
    // Local: Use public/uploads directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    const filepath = path.join(uploadDir, filename)
    await fs.writeFile(filepath, buffer)

    return `/uploads/${filename}` // Return URL path for public files
  }
}

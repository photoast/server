import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { LogoSettings, FrameType } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_PHOTO_RATIO, LAYOUT_CONFIG, FOUR_CUT_CONFIG } from './layoutConstants'

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

export async function processImage(
  inputBuffer: Buffer | Buffer[],
  logoPath?: string,
  cropArea?: CropArea | CropArea[],
  photoAreaRatio: number = DEFAULT_PHOTO_RATIO,
  logoSettings?: LogoSettings,
  frameType: FrameType = 'single',
  backgroundColor?: string
): Promise<Buffer> {
  // Handle multi-photo layouts
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

  if (frameType === 'two-by-two') {
    return processTwoByTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor
    )
  }

  if (frameType === 'vertical-two') {
    return processVerticalTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor
    )
  }

  if (frameType === 'one-plus-two') {
    return processOnePlusTwoImage(
      inputBuffer as Buffer[],
      cropArea as CropArea[],
      backgroundColor
    )
  }

  // Handle single frame with logo
  if (frameType === 'single-with-logo') {
    const singleBuffer = Array.isArray(inputBuffer) ? inputBuffer[0] : inputBuffer
    const singleCropArea = Array.isArray(cropArea) ? cropArea[0] : cropArea
    return processSingleImage(singleBuffer, singleCropArea, logoPath, logoSettings)
  }

  // Handle single frame (no logo)
  const singleBuffer = Array.isArray(inputBuffer) ? inputBuffer[0] : inputBuffer
  const singleCropArea = Array.isArray(cropArea) ? cropArea[0] : cropArea
  return processSingleImage(singleBuffer, singleCropArea)
}

async function processSingleImage(
  inputBuffer: Buffer,
  cropArea?: CropArea,
  logoPath?: string,
  logoSettings?: LogoSettings
): Promise<Buffer> {
  // Calculate photo and logo area
  const ratio = logoPath ? 85 : 100 // 85% for photo if logo exists, 100% otherwise
  const photoHeight = Math.round(TARGET_HEIGHT * (ratio / 100))
  const logoHeight = TARGET_HEIGHT - photoHeight

  console.log(`Single image layout: Photo area ${ratio}% (${photoHeight}px), Logo area ${100-ratio}% (${logoHeight}px)`)

  let image = sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation

  // Get original image metadata
  const metadata = await image.metadata()
  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0

  console.log(`Original image: ${originalWidth}x${originalHeight}`)

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
    .resize(TARGET_WIDTH, photoHeight, {
      fit: hasCrop ? 'fill' : 'cover',
      position: 'centre',
    })
    .toBuffer()

  console.log(`Target size: ${TARGET_WIDTH}x${TARGET_HEIGHT} (4x6 inch @ 300 DPI)`)

  // Create a blank canvas for the final image with white background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
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

        console.log('Processing logo with settings:', { position, sizePercent, x: logoSettings?.x, y: logoSettings?.y })

        // Calculate logo size based on settings (percentage of TOTAL image width, not logo area)
        // Allow logo to be any size - if it goes into photo area, it will be clipped by composite
        const requestedLogoWidth = Math.round(TARGET_WIDTH * (sizePercent / 100))

        // Resize logo based on width - no height limit, allow it to extend into photo area
        const logoBuffer = await sharp(logoFullPath)
          .resize(requestedLogoWidth, null, {
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

        // Clamp position to keep logo within canvas bounds
        // Allow logo to extend into photo area (top can be < photoHeight)
        // Photo layer will be composited on top, so photo area takes priority
        left = Math.max(-logoWidth, Math.min(left, TARGET_WIDTH))
        top = Math.max(0, Math.min(top, TARGET_HEIGHT))

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
  logoSettings?: LogoSettings | undefined,
  cropAreas?: CropArea[],
  backgroundColor?: string
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

  // Add logo overlay to both strips
  if (logoPath && logoSettings) {
    const logoData = await addLogoOverlay(logoPath, logoSettings, stripWidth, TARGET_HEIGHT)

    if (logoData) {
      // Position logo at bottom center of left strip
      const leftStripLogoLeft = MARGIN_OUTER + Math.round((stripWidth - logoData.width) / 2)
      const leftStripLogoTop = TARGET_HEIGHT - MARGIN_OUTER - logoData.height - 10

      // Position logo at bottom center of right strip
      const rightStripLogoLeft = MARGIN_OUTER + stripWidth + GAP_CENTER + Math.round((stripWidth - logoData.width) / 2)
      const rightStripLogoTop = leftStripLogoTop

      composites.push({
        input: logoData.buffer,
        top: leftStripLogoTop,
        left: leftStripLogoLeft,
      })

      composites.push({
        input: logoData.buffer,
        top: rightStripLogoTop,
        left: rightStripLogoLeft,
      })

      console.log(`Logo added to both strips: ${logoData.width}x${logoData.height}px, size setting: ${logoSettings.size}%`)
    }
  }

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

// Helper function to get logo full path
function getLogoFullPath(logoPath: string): string {
  if (logoPath.startsWith('/api/serve-image/')) {
    const filename = logoPath.replace('/api/serve-image/', '')
    return path.join('/tmp/uploads', filename)
  } else if (logoPath.startsWith('/uploads/')) {
    return path.join(process.cwd(), 'public', logoPath)
  } else if (logoPath.startsWith('/tmp')) {
    return logoPath
  } else {
    return path.join(process.cwd(), 'public', logoPath)
  }
}

// Helper function to add logo to composites array
async function addLogoOverlay(
  logoPath: string,
  logoSettings: LogoSettings | undefined,
  canvasWidth: number,
  canvasHeight: number,
  bottomMargin: number = 0
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const logoFullPath = getLogoFullPath(logoPath)
    const logoExists = await fs.access(logoFullPath).then(() => true).catch(() => false)

    if (!logoExists) {
      return null
    }

    // Get logo settings or use defaults
    const sizePercent = logoSettings?.size || 80 // Default 80% of canvas width

    // Calculate logo width based on settings (percentage of canvas width)
    const targetLogoWidth = Math.round(canvasWidth * (sizePercent / 100))

    // Resize logo proportionally based on width
    const logoBuffer = await sharp(logoFullPath)
      .resize(targetLogoWidth, null, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .toBuffer()

    const logoMetadata = await sharp(logoBuffer).metadata()
    const logoWidth = logoMetadata.width || 0
    const logoHeight = logoMetadata.height || 0

    return { buffer: logoBuffer, width: logoWidth, height: logoHeight }
  } catch (error) {
    console.error('Error processing logo:', error)
    return null
  }
}

// Helper function to position logo based on settings
function calculateLogoPosition(
  logoSettings: LogoSettings | undefined,
  logoWidth: number,
  logoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  photoHeight: number,
  logoAreaHeight: number
): { left: number; top: number } {
  const position = logoSettings?.position || 'bottom-center'

  if (position === 'custom' && logoSettings?.x !== undefined && logoSettings?.y !== undefined) {
    // Use custom position (percentage of logo area)
    const centerX = Math.round((logoSettings.x / 100) * canvasWidth)
    const centerY = photoHeight + Math.round((logoSettings.y / 100) * logoAreaHeight)

    return {
      left: centerX - Math.round(logoWidth / 2),
      top: centerY - Math.round(logoHeight / 2)
    }
  }

  // Parse position string
  const [vertical, horizontal] = position.split('-')

  let left = 0
  let top = 0

  // Calculate horizontal position
  if (horizontal === 'left') {
    left = 20 // Left padding
  } else if (horizontal === 'center') {
    left = Math.round((canvasWidth - logoWidth) / 2)
  } else if (horizontal === 'right') {
    left = canvasWidth - logoWidth - 20 // Right padding
  }

  // Calculate vertical position within logo area
  if (vertical === 'top') {
    top = photoHeight + 20 // Top of logo area with padding
  } else if (vertical === 'center') {
    top = photoHeight + Math.round((logoAreaHeight - logoHeight) / 2)
  } else if (vertical === 'bottom') {
    top = canvasHeight - logoHeight - 20 // Bottom with padding
  }

  return { left, top }
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
  // - Gap between photos: configurable
  // - Left/Right margin: configurable
  // - Top/Bottom margin: configurable
  // - Background: Customizable (default black)

  const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG

  // No logo for this layout - full canvas used for photos
  const photoAreaHeight = TARGET_HEIGHT

  console.log(`Two-by-Two layout: Photo area 100% (${photoAreaHeight}px)`)

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

async function processVerticalTwoImage(
  inputBuffers: Buffer[],
  cropAreas?: CropArea[],
  backgroundColor?: string
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

  // No logo for this layout - full canvas used for photos
  const photoAreaHeight = TARGET_HEIGHT

  console.log(`Vertical-Two layout: Photo area 100% (${photoAreaHeight}px)`)

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
  backgroundColor?: string
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

  // No logo for this layout - full canvas used for photos
  const photoAreaHeight = TARGET_HEIGHT

  console.log(`One-Plus-Two layout: Photo area 100% (${photoAreaHeight}px)`)

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
    let image = sharp(inputBuffers[0]).rotate() // Auto-rotate based on EXIF

    // Apply crop if provided
    if (cropAreas && cropAreas[0] && cropAreas[0].width > 0 && cropAreas[0].height > 0) {
      const metadata = await image.metadata()
      const originalWidth = metadata.width || 0
      const originalHeight = metadata.height || 0

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
    let image = sharp(inputBuffers[i]).rotate() // Auto-rotate based on EXIF

    // Apply crop if provided
    if (cropAreas && cropAreas[i] && cropAreas[i].width > 0 && cropAreas[i].height > 0) {
      const metadata = await image.metadata()
      const originalWidth = metadata.width || 0
      const originalHeight = metadata.height || 0

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

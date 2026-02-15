import { LogoSettings } from './types'

/**
 * Canvas에서 single-with-logo 레이아웃을 렌더링
 * @param photoUrl - 사진 이미지 URL (cropped)
 * @param logoUrl - 로고 이미지 URL (옵셔널)
 * @param photoAreaRatio - 사진 영역 비율 (0-100, 기본 85)
 * @param logoSettings - 로고 위치 및 크기 설정
 * @returns Blob (JPEG 이미지)
 */
export async function renderSingleWithLogoToCanvas(
  photoUrl: string,
  logoUrl?: string,
  photoAreaRatio: number = 85,
  logoSettings: LogoSettings = { position: 'bottom-center', size: 80 }
): Promise<Blob> {
  console.log('[Canvas] Starting canvas rendering...')
  const canvas = document.createElement('canvas')
  const CANVAS_WIDTH = 1200
  const CANVAS_HEIGHT = 1800
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  const photoHeight = Math.round(CANVAS_HEIGHT * (photoAreaRatio / 100))
  const logoAreaHeight = CANVAS_HEIGHT - photoHeight

  console.log('[Canvas] Settings:', { photoAreaRatio, logoSettings, photoHeight, logoAreaHeight })

  // 1. Fill white background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // 2. Draw photo
  console.log('[Canvas] Loading photo image...')
  const photoImg = await loadImage(photoUrl)
  console.log('[Canvas] Photo loaded:', photoImg.width, 'x', photoImg.height)
  ctx.drawImage(photoImg, 0, 0, CANVAS_WIDTH, photoHeight)
  console.log('[Canvas] Photo drawn')

  // 3. Draw logo
  if (logoUrl) {
    console.log('[Canvas] Loading logo image:', logoUrl)
    try {
      const logoImg = await loadImage(logoUrl)
      console.log('[Canvas] Logo loaded:', logoImg.width, 'x', logoImg.height)

      const logoSize = logoSettings.size || 80
      const position = logoSettings.position || 'bottom-center'

      // Calculate logo size based on full width (matching client CSS)
      const requestedLogoWidth = CANVAS_WIDTH * (logoSize / 100)
      const logoAspectRatio = logoImg.width / logoImg.height
      const logoWidth = requestedLogoWidth
      const logoHeight = requestedLogoWidth / logoAspectRatio

      let logoX = 0
      let logoY = 0

      if (position === 'custom' && logoSettings.x !== undefined && logoSettings.y !== undefined) {
        // Custom position
        logoX = (logoSettings.x / 100) * CANVAS_WIDTH - logoWidth / 2
        logoY = photoHeight + (logoSettings.y / 100) * logoAreaHeight - logoHeight / 2
      } else {
        // Preset positions
        const [vertical, horizontal] = position.split('-')
        const PADDING = 8

        // Horizontal
        if (horizontal === 'left') {
          logoX = PADDING
        } else if (horizontal === 'center') {
          logoX = (CANVAS_WIDTH - logoWidth) / 2
        } else if (horizontal === 'right') {
          logoX = CANVAS_WIDTH - logoWidth - PADDING
        }

        // Vertical (within logo area)
        if (vertical === 'top') {
          logoY = photoHeight + PADDING
        } else if (vertical === 'center') {
          logoY = photoHeight + (logoAreaHeight - logoHeight) / 2
        } else if (vertical === 'bottom') {
          logoY = CANVAS_HEIGHT - logoHeight - PADDING
        }
      }

      console.log('[Canvas] Drawing logo at:', { logoX, logoY, logoWidth, logoHeight, position })
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight)
      console.log('[Canvas] Logo drawn')
    } catch (logoError) {
      console.error('[Canvas] Failed to draw logo:', logoError)
      // Continue without logo - don't fail the entire render
    }
  }

  // Convert canvas to blob
  console.log('[Canvas] Converting to blob...')
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        console.log('[Canvas] Blob created, size:', blob.size)
        resolve(blob)
      } else {
        console.error('[Canvas] Failed to create blob')
        reject(new Error('Failed to create blob from canvas'))
      }
    }, 'image/jpeg', 0.95)
  })
}

/**
 * 이미지 로드 헬퍼 함수
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    // Don't set crossOrigin for same-origin requests (local /uploads/)
    if (!url.startsWith('/uploads/')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = (e) => {
      console.error('[Canvas] Image load error:', e)
      reject(new Error(`Failed to load image: ${url}`))
    }
    img.src = url
  })
}

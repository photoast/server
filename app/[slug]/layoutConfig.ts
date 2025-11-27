import { FrameType } from '@/lib/types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, LAYOUT_CONFIG, FOUR_CUT_CONFIG } from '@/lib/layoutConstants'

export interface LayoutOption {
  type: FrameType
  name: string
  nameEn: string
  description: string
  photoCount: number
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    type: 'single',
    name: '일반 1장',
    nameEn: 'Single Photo',
    description: '4×6 세로 1장',
    photoCount: 1
  },
  {
    type: 'single-with-logo',
    name: '로고 포함 1장',
    nameEn: 'Single with Logo',
    description: '4×6 세로 + 로고',
    photoCount: 1
  },
  {
    type: 'landscape-single',
    name: '가로 1장',
    nameEn: 'Landscape Single',
    description: '6×4 가로 1장',
    photoCount: 1
  },
  {
    type: 'landscape-two',
    name: '가로 2장',
    nameEn: 'Landscape 2',
    description: '6×4 가로 2×1',
    photoCount: 2
  },
  {
    type: 'vertical-two',
    name: '세로 2장',
    nameEn: 'Vertical 2',
    description: '4×6 세로 1×2',
    photoCount: 2
  },
  {
    type: 'one-plus-two',
    name: '1+2 레이아웃',
    nameEn: '1+2 Layout',
    description: '위 1장, 아래 2장',
    photoCount: 3
  },
  {
    type: 'four-cut',
    name: '1*4 네컷',
    nameEn: 'Four-Cut',
    description: '4장 세로 스트립 (2개)',
    photoCount: 4
  },
  {
    type: 'two-by-two',
    name: '2×2 그리드',
    nameEn: '2×2 Grid',
    description: '4장 그리드',
    photoCount: 4
  }
]

export function getLayoutOption(type: FrameType): LayoutOption | undefined {
  return LAYOUT_OPTIONS.find(option => option.type === type)
}

export function getPhotoCount(type: FrameType): number {
  return getLayoutOption(type)?.photoCount || 1
}

export function getCropAspectRatio(type: FrameType, hasLogo: boolean = false, photoAreaRatio: number = 85): number {
  // Calculate exact ratios dynamically from layout constants
  // These must match the actual output dimensions in lib/image.ts

  // Landscape layouts use swapped dimensions (6x4 instead of 4x6)
  const isLandscape = type === 'landscape-single' || type === 'landscape-two'
  const canvasWidth = isLandscape ? CANVAS_HEIGHT : CANVAS_WIDTH   // 1800 or 1200
  const canvasHeight = isLandscape ? CANVAS_WIDTH : CANVAS_HEIGHT  // 1200 or 1800

  let baseRatio: number

  if (type === 'single-with-logo') {
    // Single with logo: photo area uses photoAreaRatio
    const photoAreaHeight = Math.round(canvasHeight * (photoAreaRatio / 100))
    baseRatio = canvasWidth / photoAreaHeight
  } else if (type === 'landscape-single') {
    // Landscape single: full 6x4 canvas
    baseRatio = canvasWidth / canvasHeight  // 1800/1200 = 1.5
  } else if (type === 'landscape-two') {
    // Landscape two: 2 photos side by side (2x1 grid)
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const availableWidth = canvasWidth - (MARGIN_HORIZONTAL * 2)
    const availableHeight = canvasHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = Math.round((availableWidth - GAP) / 2)
    const photoHeight = availableHeight
    baseRatio = photoWidth / photoHeight
  } else if (type === 'four-cut') {
    // Match lib/image.ts processFourCutImage calculations
    const { MARGIN_OUTER, GAP_CENTER, GAP_BETWEEN_PHOTOS } = FOUR_CUT_CONFIG
    const stripWidth = Math.round((canvasWidth - (MARGIN_OUTER * 2) - GAP_CENTER) / 2)
    const stripHeight = canvasHeight - (MARGIN_OUTER * 2)
    const photoWidth = stripWidth
    const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3
    const photoHeight = Math.round((stripHeight - totalGapsHeight) / 4)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'two-by-two') {
    // Match lib/image.ts processTwoByTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const availableWidth = canvasWidth - (MARGIN_HORIZONTAL * 2)
    const availableHeight = canvasHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = Math.round((availableWidth - GAP) / 2)
    const photoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'vertical-two') {
    // Match lib/image.ts processVerticalTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const availableWidth = canvasWidth - (MARGIN_HORIZONTAL * 2)
    const availableHeight = canvasHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = availableWidth
    const photoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'one-plus-two') {
    // Match lib/image.ts processOnePlusTwoImage - top photo
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const availableWidth = canvasWidth - (MARGIN_HORIZONTAL * 2)
    const availableHeight = canvasHeight - (MARGIN_VERTICAL * 2)
    const topPhotoWidth = availableWidth
    const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = topPhotoWidth / topPhotoHeight
  } else {
    // Single photo default (no logo)
    baseRatio = canvasWidth / canvasHeight
  }

  return baseRatio
}

export function getCropAspectRatioForSlot(type: FrameType, slotIndex: number, hasLogo: boolean = false, photoAreaRatio: number = 85): number {
  if (type === 'one-plus-two') {
    // Match lib/image.ts processOnePlusTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = CANVAS_HEIGHT - (MARGIN_VERTICAL * 2)

    const topPhotoWidth = availableWidth
    const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
    const bottomPhotoWidth = Math.round((availableWidth - GAP) / 2)
    const bottomPhotoHeight = topPhotoHeight

    const topRatio = topPhotoWidth / topPhotoHeight
    const bottomRatio = bottomPhotoWidth / bottomPhotoHeight

    return slotIndex === 0 ? topRatio : bottomRatio
  }
  return getCropAspectRatio(type, hasLogo, photoAreaRatio)
}

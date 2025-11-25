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
    description: '사진 1장',
    photoCount: 1
  },
  {
    type: 'vertical-two',
    name: '세로 2장',
    nameEn: 'Vertical 2',
    description: '세로로 2장',
    photoCount: 2
  },
  {
    type: 'horizontal-two',
    name: '가로 2장',
    nameEn: 'Horizontal 2',
    description: '가로로 2장',
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

export function getCropAspectRatio(type: FrameType, hasLogo: boolean = false): number {
  // Calculate exact ratios dynamically from layout constants
  // These must match the actual output dimensions in lib/image.ts

  let baseRatio: number

  if (type === 'four-cut') {
    // Match lib/image.ts processFourCutImage calculations
    const { MARGIN_OUTER, GAP_CENTER, GAP_BETWEEN_PHOTOS } = FOUR_CUT_CONFIG
    const stripWidth = Math.round((CANVAS_WIDTH - (MARGIN_OUTER * 2) - GAP_CENTER) / 2)
    const stripHeight = CANVAS_HEIGHT - (MARGIN_OUTER * 2)
    const photoWidth = stripWidth
    const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3
    const photoHeight = Math.round((stripHeight - totalGapsHeight) / 4)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'two-by-two') {
    // Match lib/image.ts processTwoByTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const photoAreaHeight = CANVAS_HEIGHT // No logo in crop, assume 100%
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = Math.round((availableWidth - GAP) / 2)
    const photoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'vertical-two') {
    // Match lib/image.ts processVerticalTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const photoAreaHeight = CANVAS_HEIGHT
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = availableWidth
    const photoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = photoWidth / photoHeight
  } else if (type === 'horizontal-two') {
    // Match lib/image.ts processHorizontalTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const photoAreaHeight = CANVAS_HEIGHT
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)
    const photoWidth = Math.round((availableWidth - GAP) / 2)
    const photoHeight = availableHeight
    baseRatio = photoWidth / photoHeight
  } else if (type === 'one-plus-two') {
    // Match lib/image.ts processOnePlusTwoImage - top photo
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const photoAreaHeight = CANVAS_HEIGHT
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)
    const topPhotoWidth = availableWidth
    const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
    baseRatio = topPhotoWidth / topPhotoHeight
  } else {
    // Single photo default
    baseRatio = CANVAS_WIDTH / CANVAS_HEIGHT
  }

  // If logo exists, adjust the crop ratio to account for logo space
  // Logo typically takes up ~15% of the height in single layout
  // For multi-photo layouts, logo is overlaid so no adjustment needed
  if (hasLogo && type === 'single') {
    // Adjust height to account for logo space (85% of total height for photo)
    // So crop ratio should be width / (height * 0.85)
    return baseRatio / 0.85
  }

  return baseRatio
}

export function getCropAspectRatioForSlot(type: FrameType, slotIndex: number, hasLogo: boolean = false): number {
  if (type === 'one-plus-two') {
    // Match lib/image.ts processOnePlusTwoImage
    const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
    const photoAreaHeight = CANVAS_HEIGHT
    const availableWidth = CANVAS_WIDTH - (MARGIN_HORIZONTAL * 2)
    const availableHeight = photoAreaHeight - (MARGIN_VERTICAL * 2)

    const topPhotoWidth = availableWidth
    const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
    const bottomPhotoWidth = Math.round((availableWidth - GAP) / 2)
    const bottomPhotoHeight = topPhotoHeight

    const topRatio = topPhotoWidth / topPhotoHeight
    const bottomRatio = bottomPhotoWidth / bottomPhotoHeight

    return slotIndex === 0 ? topRatio : bottomRatio
  }
  return getCropAspectRatio(type, hasLogo)
}

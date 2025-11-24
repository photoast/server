import { FrameType } from '@/lib/types'

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
  // Base ratios for layouts WITHOUT logo (100% photo area)
  const baseRatios: Record<FrameType, number> = {
    'single': 1000 / 1500,        // 2:3 ratio
    'four-cut': 900 / 685,        // Four-cut strip ratio
    'two-by-two': 450 / 680,      // Grid cell ratio
    'vertical-two': 920 / 680,    // Vertical split ratio
    'horizontal-two': 450 / 1380, // Horizontal split ratio
    'one-plus-two': 920 / 680     // Default for first slot
  }

  const baseRatio = baseRatios[type] || 1000 / 1500

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
    const topRatio = 920 / 680
    const bottomRatio = 450 / 680
    return slotIndex === 0 ? topRatio : bottomRatio
  }
  return getCropAspectRatio(type, hasLogo)
}

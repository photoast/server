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

export function getCropAspectRatio(type: FrameType): number {
  const ratios: Record<FrameType, number> = {
    'single': 1000 / 1500,
    'four-cut': 900 / 685,
    'two-by-two': 450 / 680,
    'vertical-two': 920 / 680,
    'horizontal-two': 450 / 1380,
    'one-plus-two': 920 / 680 // Default for first slot
  }

  return ratios[type] || 1000 / 1500
}

export function getCropAspectRatioForSlot(type: FrameType, slotIndex: number): number {
  if (type === 'one-plus-two') {
    return slotIndex === 0 ? 920 / 680 : 450 / 680
  }
  return getCropAspectRatio(type)
}

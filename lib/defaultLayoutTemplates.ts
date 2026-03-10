import type { PrintSize, SwitSlot, SwitFrameLayer } from './types'

interface DefaultLayoutTemplate {
  name: string
  nameEn: string
  printSize: PrintSize
  canvasWidth: number
  canvasHeight: number
  slots: Pick<SwitSlot, 'x' | 'y' | 'width' | 'height' | 'aspectRatio'>[]
  frameLayers: SwitFrameLayer[]
  backgroundColor: string
  backgroundColorCustomizable: boolean
}

// layoutConstants.ts 기반 좌표 계산:
// LAYOUT_CONFIG: MARGIN_H=20, MARGIN_V=20, GAP=20
// FOUR_CUT_CONFIG: MARGIN_OUTER=13, GAP_CENTER=26, GAP_BETWEEN_PHOTOS=13

export const DEFAULT_LAYOUT_TEMPLATES: DefaultLayoutTemplate[] = [
  {
    name: '일반 1장',
    nameEn: 'Single Photo',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 0, y: 0, width: 1200, height: 1800, aspectRatio: '2:3' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: false,
  },
  {
    name: '세로 2장',
    nameEn: 'Vertical 2',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 20, y: 20, width: 1160, height: 870, aspectRatio: 'free' },
      { x: 20, y: 910, width: 1160, height: 870, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: true,
  },
  {
    name: '1+2 레이아웃',
    nameEn: '1+2 Layout',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 20, y: 20, width: 1160, height: 870, aspectRatio: 'free' },
      { x: 20, y: 910, width: 570, height: 870, aspectRatio: 'free' },
      { x: 610, y: 910, width: 570, height: 870, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: true,
  },
  {
    name: '2×2 그리드',
    nameEn: '2×2 Grid',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 20, y: 20, width: 570, height: 870, aspectRatio: 'free' },
      { x: 610, y: 20, width: 570, height: 870, aspectRatio: 'free' },
      { x: 20, y: 910, width: 570, height: 870, aspectRatio: 'free' },
      { x: 610, y: 910, width: 570, height: 870, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: true,
  },
  {
    name: '가로 1장',
    nameEn: 'Landscape Single',
    printSize: '6x4',
    canvasWidth: 1800,
    canvasHeight: 1200,
    slots: [
      { x: 0, y: 0, width: 1800, height: 1200, aspectRatio: '3:2' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: false,
  },
  {
    name: '가로 2장',
    nameEn: 'Landscape 2',
    printSize: '6x4',
    canvasWidth: 1800,
    canvasHeight: 1200,
    slots: [
      { x: 20, y: 20, width: 870, height: 1160, aspectRatio: 'free' },
      { x: 910, y: 20, width: 870, height: 1160, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: true,
  },
  {
    name: '인스타그램',
    nameEn: 'Instagram',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    // 사진: 풀너비, 헤더(100px) 아래부터 액션바(90px)+하단(186px) 위까지 = 1424px
    slots: [
      { x: 0, y: 100, width: 1200, height: 1424, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: false,
  },
  {
    name: '1×4 네컷',
    nameEn: 'Four-Cut',
    printSize: '4x6',
    canvasWidth: 1200,
    canvasHeight: 1800,
    // 좌측 strip (x=13) + 우측 strip (x=613), 각 574×434
    slots: [
      // Left strip
      { x: 13, y: 13, width: 574, height: 434, aspectRatio: 'free' },
      { x: 13, y: 460, width: 574, height: 434, aspectRatio: 'free' },
      { x: 13, y: 907, width: 574, height: 434, aspectRatio: 'free' },
      { x: 13, y: 1354, width: 574, height: 434, aspectRatio: 'free' },
      // Right strip
      { x: 613, y: 13, width: 574, height: 434, aspectRatio: 'free' },
      { x: 613, y: 460, width: 574, height: 434, aspectRatio: 'free' },
      { x: 613, y: 907, width: 574, height: 434, aspectRatio: 'free' },
      { x: 613, y: 1354, width: 574, height: 434, aspectRatio: 'free' },
    ],
    frameLayers: [],
    backgroundColor: '#FFFFFF',
    backgroundColorCustomizable: true,
  },
]

import { ObjectId } from 'mongodb'

// ============ SWIT Photo Layout Authoring ============

export type PrintSize = '4x6' | '2x6' | '6x4'

export const PRINT_SIZE_DIMENSIONS: Record<PrintSize, { width: number; height: number }> = {
  '4x6': { width: 1200, height: 1800 },
  '2x6': { width: 600, height: 1800 },
  '6x4': { width: 1800, height: 1200 },
}

export interface SwitSlot {
  id: string
  x: number       // canvas pixels from left
  y: number       // canvas pixels from top
  width: number   // canvas pixels
  height: number  // canvas pixels
  aspectRatio: '1:1' | '2:3' | '3:4' | '3:2' | '4:3' | 'free'
  order: number
  zIndex: number  // layer z-order (default 10)
  rotation: number // degrees (0-360), default 0
}

export interface SwitFrameLayer {
  id: string           // "layer-{timestamp}"
  name: string         // display name (e.g. "배경", "프레임")
  imageUrl: string     // PNG/JPG/WebP URL
  zIndex: number       // render order (lower = behind)
  opacity: number      // 0-1
  visible: boolean     // toggle in editor
  x?: number           // canvas pixels from left (default 0)
  y?: number           // canvas pixels from top (default 0)
  width?: number       // canvas pixels (default canvasWidth)
  height?: number      // canvas pixels (default canvasHeight)
  rotation?: number    // degrees (default 0)
}

export interface SwitLayout {
  _id: string
  eventId: string
  name: string
  printSize: PrintSize
  canvasWidth: number   // 300dpi canonical size
  canvasHeight: number
  slots: SwitSlot[]
  frameLayers: SwitFrameLayer[]  // image layers (backgrounds, frames, decorations)
  frameUrl: string | null        // deprecated, kept for backward compat
  backgroundColor: string        // background color hex (default '#FFFFFF')
  backgroundColorCustomizable: boolean // true = client can change bg color
  isPreset: boolean              // true = auto-created from default template
  order: number                  // display order (lower = first)
  createdAt: string
  updatedAt: string
}

/** Normalize legacy layouts: migrate frameUrl → frameLayers, ensure slot.zIndex */
export function normalizeLayout(layout: SwitLayout): SwitLayout {
  if (!layout.frameLayers) {
    layout.frameLayers = []
  }
  if (layout.frameUrl && layout.frameLayers.length === 0) {
    layout.frameLayers = [{
      id: 'legacy-frame',
      name: '프레임',
      imageUrl: layout.frameUrl,
      zIndex: 100,
      opacity: 1,
      visible: true,
    }]
  }
  layout.slots = layout.slots.map((s, i) => ({
    ...s,
    zIndex: s.zIndex ?? (10 + i),
    rotation: s.rotation ?? 0,
  }))
  return layout
}

export type FrameType = 'single' | 'four-cut' | 'two-by-two' | 'vertical-two' | 'one-plus-two' | 'landscape-single' | 'landscape-two'

export interface Sticker {
  _id?: ObjectId
  url: string
  filename: string
  createdAt: Date
}

export type PrintMethod = 'email' | 'polling'

export interface Printer {
  _id?: ObjectId
  name: string              // e.g. "사무실 Epson L3150"
  printMethod: PrintMethod  // 'email' | 'polling'
  email?: string            // Epson Connect 이메일 주소 (email 방식일 때 필수)
  borderCorrectionEnabled: boolean
  shrinkPercent: number     // default: 97.5
  verticalOffsetPx: number  // default: 0
  createdAt: Date
}

export interface Event {
  _id?: ObjectId
  name: string
  slug: string
  printerId?: string // References Printer._id
  availableLayouts?: FrameType[]
  puzzleEnabled?: boolean
  price?: number
  backgroundColors?: string[]
  createdAt: Date
}

export interface DeviceInfo {
  userAgent: string
  deviceId?: string // Browser-generated UUID
  ipAddress?: string
  deviceType?: string // mobile, tablet, desktop
  os?: string
  browser?: string
  screenResolution?: string
  timezone?: string
}

export interface PrintJob {
  _id?: ObjectId
  eventId: string
  imageUrl: string
  printedImageUrl?: string // The actual image sent to printer (corrected/rotated)
  createdAt: Date
  status: 'DONE' | 'FAILED'
  deviceInfo?: DeviceInfo
  errorMessage?: string
}

export interface Admin {
  _id?: ObjectId
  username: string
  passwordHash: string
}

export type ErrorLevel = 'error' | 'warning' | 'info'

export interface ErrorLog {
  _id?: ObjectId
  level: ErrorLevel
  message: string
  stack?: string
  url?: string
  userAgent?: string
  timestamp: Date
  eventSlug?: string
  additionalData?: Record<string, any>
}

import { ObjectId } from 'mongodb'

// ============ Photo Frame Layout Authoring ============

export type PrintSize = '4x6' | '2x6' | '6x4'

export const PRINT_SIZE_DIMENSIONS: Record<PrintSize, { width: number; height: number }> = {
  '4x6': { width: 1200, height: 1800 },
  '2x6': { width: 600, height: 1800 },
  '6x4': { width: 1800, height: 1200 },
}

export interface PhotoSlot {
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

export interface FrameLayer {
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

export interface FrameLayout {
  _id: string
  eventId: string
  name: string
  printSize: PrintSize
  canvasWidth: number   // 300dpi canonical size
  canvasHeight: number
  slots: PhotoSlot[]
  frameLayers: FrameLayer[]  // image layers (backgrounds, frames, decorations)
  frameUrl: string | null        // deprecated, kept for backward compat
  backgroundColor: string        // background color hex (default '#FFFFFF')
  backgroundColorCustomizable: boolean // true = client can change bg color
  visible?: boolean              // true (default) = exposed to users, false = hidden
  isPreset: boolean              // true = auto-created from default template
  order: number                  // display order (lower = first)
  createdAt: string
  updatedAt: string
}

/** Normalize legacy layouts: migrate frameUrl → frameLayers, ensure slot.zIndex */
export function normalizeLayout(layout: FrameLayout): FrameLayout {
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

export type PrintMethod = 'email' | 'polling' | 'epson_api'

export interface EpsonApiAuth {
  apiKey: string             // x-api-key 헤더
  accessToken: string        // Bearer 토큰 (어드민이 직접 입력)
  refreshToken?: string      // 리프레시 토큰 (선택, 자동 갱신용)
  clientId?: string          // OAuth client_id (리프레시 시 필요)
  clientSecret?: string      // OAuth client_secret (리프레시 시 필요)
  tokenExpiresAt?: number    // Unix timestamp (ms)
}

export interface Printer {
  _id?: ObjectId
  name: string              // e.g. "사무실 Epson L3150"
  printMethod: PrintMethod  // 'email' | 'polling' | 'epson_api'
  email?: string            // Epson Connect 이메일 주소 (email 방식일 때 필수)
  apiKey?: string           // polling 프린터 인증용 UUID
  epsonAuth?: EpsonApiAuth  // Epson Connect API 인증 정보
  supportedSizes: PrintSize[] // e.g. ['4x6', '6x4'] — 프린터가 지원하는 인쇄 규격
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
  donation?: {
    enabled: boolean
    bank: string        // e.g. "카카오뱅크"
    account: string     // e.g. "3333-36-8761932"
    holder?: string     // 예금주
    message?: string    // 안내 문구
    link?: string       // 송금 링크 (토스, 카카오페이 등)
  }
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
  printerId?: string       // polling 프린터의 job일 때 프린터 ID
  imageUrl: string
  printedImageUrl?: string // The actual image sent to printer (corrected/rotated)
  createdAt: Date
  status: 'PENDING' | 'DONE' | 'FAILED'
  deviceInfo?: DeviceInfo
  errorMessage?: string
  userId?: string
  paymentKey?: string
  paymentAmount?: number
  refunded?: boolean
}

export interface User {
  _id?: ObjectId
  provider: 'google' | 'kakao'
  providerId: string
  email?: string
  name?: string
  profileImage?: string
  credits: number
  createdAt: Date
  updatedAt: Date
}

export interface CreditTransaction {
  _id?: ObjectId
  userId: string
  amount: number
  type: 'charge' | 'use' | 'refund'
  description: string
  relatedPrintJobId?: string
  relatedPaymentKey?: string
  createdBy?: string
  createdAt: Date
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

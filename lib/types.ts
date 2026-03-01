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
}

export interface SwitLayout {
  _id: string
  eventId: string
  name: string
  printSize: PrintSize
  canvasWidth: number   // 300dpi canonical size
  canvasHeight: number
  slots: SwitSlot[]
  frameUrl: string | null  // Top layer: transparent PNG frame
  createdAt: string
  updatedAt: string
}

export interface LogoSettings {
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'custom'
  size: number // Percentage of logo area width (10-100)
  x?: number // Custom X position in logo area (0-100 percent)
  y?: number // Custom Y position in logo area (0-100 percent)
}

export type FrameType = 'single' | 'single-with-logo' | 'single-with-logo-overlay' | 'four-cut' | 'two-by-two' | 'vertical-two' | 'one-plus-two' | 'landscape-single' | 'landscape-two' | 'puzzle-2x2' | 'puzzle-3x3' | 'free-layout'

export interface Sticker {
  _id?: ObjectId
  url: string
  filename: string
  createdAt: Date
}

export interface Event {
  _id?: ObjectId
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  logoBase64?: string // Base64 encoded logo for Vercel (serverless) environment
  photoAreaRatio?: number // Percentage of photo area (default 85, range 0-100)
  logoSettings?: LogoSettings // Logo position and size settings (for single-with-logo)
  overlayLogoSettings?: LogoSettings // Logo position and size settings (for single-with-logo-overlay)
  availableLayouts?: FrameType[] // Layouts available for this event (default: all)
  price?: number // Payment amount in KRW (default: 0 = free)
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

import { ObjectId } from 'mongodb'

export interface LogoSettings {
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'custom'
  size: number // Percentage of logo area width (10-100)
  x?: number // Custom X position in logo area (0-100 percent)
  y?: number // Custom Y position in logo area (0-100 percent)
}

export type FrameType = 'single' | 'four-cut' | 'two-by-two'

export interface Event {
  _id?: ObjectId
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  photoAreaRatio?: number // Percentage of photo area (default 85, range 0-100)
  logoSettings?: LogoSettings // Logo position and size settings
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

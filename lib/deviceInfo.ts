import { DeviceInfo } from './types'

// Generate or retrieve a persistent device ID
function getDeviceId(): string {
  const storageKey = 'phost_device_id'

  if (typeof window === 'undefined') {
    return 'server-side'
  }

  let deviceId = localStorage.getItem(storageKey)

  if (!deviceId) {
    deviceId = generateUUID()
    localStorage.setItem(storageKey, deviceId)
  }

  return deviceId
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function detectDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent.toLowerCase()

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|windows phone/i.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

function detectOS(): string {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent

  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os x/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'

  return 'Unknown'
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent

  if (/edg/i.test(ua)) return 'Edge'
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/opera|opr/i.test(ua)) return 'Opera'

  return 'Unknown'
}

export function collectDeviceInfo(): Partial<DeviceInfo> {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'server-side',
      deviceId: 'server-side',
    }
  }

  return {
    userAgent: navigator.userAgent,
    deviceId: getDeviceId(),
    deviceType: detectDeviceType(),
    os: detectOS(),
    browser: detectBrowser(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

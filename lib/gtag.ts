export const GA_ID = 'G-PNJYXPXN2P'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('pt_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('pt_device_id', id)
  }
  return id
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('pt_session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('pt_session_id', id)
  }
  return id
}

function sendToServer(slug: string, action: string, params?: Record<string, any>) {
  const deviceId = getDeviceId()
  const sessionId = getSessionId()
  if (!deviceId || !sessionId) return

  fetch('/api/user-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, sessionId, slug, action, params }),
  }).catch(() => {})
}

function trackEvent(action: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return

  // GA4
  if (window.gtag) {
    window.gtag('event', action, {
      ...params,
      device_id: getDeviceId(),
      session_id: getSessionId(),
    })
  }

  // Server
  const slug = params?.event_slug
  if (slug) sendToServer(slug, action, params)
}

// Virtual pageview
export function trackVirtualPageview(path: string, title?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    })
  }
}

// Page enter (initial page load)
export function trackPageEnter(slug: string, path: string) {
  trackEvent('page_enter', { event_slug: slug, page_path: path })
}

// Step navigation (funnel)
export function trackStepView(step: string, slug: string) {
  trackEvent('step_view', { step, event_slug: slug })
  trackVirtualPageview(`/${slug}/step/${step}`, `${step} | Photo Toast`)
}

// Layout
export function trackLayoutSelect(layoutName: string, layoutId: string, slug: string) {
  trackEvent('layout_select', { layout_name: layoutName, layout_id: layoutId, event_slug: slug })
}

// Background color
export function trackColorSelect(color: string, slug: string) {
  trackEvent('color_select', { color, event_slug: slug })
}

// Photo
export function trackPhotoUpload(slotIndex: number, slug: string) {
  trackEvent('photo_upload', { slot_index: slotIndex, event_slug: slug })
}

export function trackPhotoCropComplete(slotIndex: number, slug: string) {
  trackEvent('photo_crop_complete', { slot_index: slotIndex, event_slug: slug })
}

export function trackAllPhotosReady(photoCount: number, slug: string) {
  trackEvent('all_photos_ready', { photo_count: photoCount, event_slug: slug })
}

// Crop editor
export function trackCropOpen(slotIndex: number, slug: string) {
  trackEvent('crop_open', { slot_index: slotIndex, event_slug: slug })
  trackVirtualPageview(`/${slug}/step/crop`, `crop | Photo Toast`)
}

export function trackCropCancel(slotIndex: number, slug: string) {
  trackEvent('crop_cancel', { slot_index: slotIndex, event_slug: slug })
}

export function trackPreviewReady(slug: string) {
  trackEvent('preview_ready', { event_slug: slug })
  trackVirtualPageview(`/${slug}/step/preview`, `preview | Photo Toast`)
}

// Payment
export function trackPaymentStart(amount: number, quantity: number, slug: string) {
  trackEvent('payment_start', { amount, quantity, event_slug: slug, currency: 'KRW' })
}

export function trackPaymentSuccess(amount: number, slug: string) {
  trackEvent('purchase', { value: amount, currency: 'KRW', event_slug: slug })
}

export function trackPaymentFail(errorMsg: string, slug: string) {
  trackEvent('payment_fail', { error_message: errorMsg, event_slug: slug })
}

// Print
export function trackPrintRequest(quantity: number, slug: string) {
  trackEvent('print_request', { quantity, event_slug: slug })
}

export function trackPrintSuccess(slug: string) {
  trackEvent('print_success', { event_slug: slug })
}

// Download
export function trackDownload(slug: string) {
  trackEvent('download', { event_slug: slug })
}

// Reset (new photo)
export function trackReset(slug: string) {
  trackEvent('reset', { event_slug: slug })
}

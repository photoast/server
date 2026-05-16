export const GA_ID = 'G-PNJYXPXN2P'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

function trackEvent(action: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, params)
  }
}

// Virtual pageview — GA4 reports에서 별도 페이지로 잡힘
export function trackVirtualPageview(path: string, title?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    })
  }
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

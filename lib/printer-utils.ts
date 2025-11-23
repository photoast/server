/**
 * Common 5x7 borderless media type names used by different printers
 */
export const BORDERLESS_5X7_MEDIA_TYPES = [
  'na_5x7_borderless',           // Common IPP standard
  'om_photo_5x7_borderless',     // HP / Canon variants
  'na_5x7_photo',                // Generic photo paper
  'oe_photo-5x7_photo',          // Other vendor formats
  'custom_5x7_127x178mm',        // User-defined custom size
]

/**
 * Fallback standard 5x7 media types (non-borderless)
 */
export const STANDARD_5X7_MEDIA_TYPES = [
  'na_5x7',
  'om_photo_5x7',
  'iso_a5_127x178mm',
  '5x7',
]

/**
 * Get IPP attributes for borderless 5×7 printing
 * 
 * NOTE:
 * - Removed `ipp-attribute-fidelity` (causing `Unknown attribute` error)
 * - Most printers accept these attributes safely
 */
// EPSON PM-400 Series 전용 5×7 무테 세팅
// EPSON PM-400 Series 5×7 용 거의 무테 세팅 (node-ipp 친화 버전)
export function getA5BorderlessAttributes() {
  return {
    media: 'iso_a5_148x210mm',

    'media-col': {
      'media-size': {
        'x-dimension': 14800,
        'y-dimension': 21000,
      },

      'media-type': 'photographic', // 사진 용지
      'media-top-margin': 0,
      'media-left-margin': 0,
      'media-right-margin': 0,
      'media-bottom-margin': 0,

      'media-source': 'main',
    },

    copies: 1,
    'print-quality': 5,
    'print-color-mode': 'color',
    'orientation-requested': 3,
  }
  
}



/**
 * Standard (non-borderless) 5×7 attributes
 * Used if borderless mode fails
 */
export function getStandardPrintAttributes() {
  return {
    // Non-borderless 5×7 media
    media: 'na_5x7',

    // Fit image to media size
    'print-scaling': 'auto-fit',

    // Portrait (3)
    'orientation-requested': 3,

    // Single copy
    copies: 1,

    // High print quality
    'print-quality': 5,

    // Color output
    'print-color-mode': 'color',

    // Optimize output for photos
    'print-content-optimize': 'photo',
  }
}

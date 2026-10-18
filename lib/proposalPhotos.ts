import { WEDDING_SLOTS } from './weddingFrames'
/** Each source is cropped once to the exact print-slot resolution and shared by every design. */
export function encodeProposalPhotos(photos: (HTMLImageElement | null)[]): string[] {
  return WEDDING_SLOTS.map((slot, i) => {
    const photo = photos[i]
    if (!photo) throw new Error('샘플 사진 3장을 선택해 주세요.')
    const canvas = document.createElement('canvas'); canvas.width = slot.width; canvas.height = slot.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, slot.width, slot.height)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    const factor = Math.max(slot.width / photo.naturalWidth, slot.height / photo.naturalHeight)
    const w = photo.naturalWidth * factor, h = photo.naturalHeight * factor
    ctx.drawImage(photo, (slot.width - w) / 2, (slot.height - h) / 2, w, h)
    return canvas.toDataURL('image/jpeg', .96)
  })
}

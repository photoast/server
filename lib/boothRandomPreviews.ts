import type { FrameLayout, PhotoSlot, PreviewPoolPhoto } from './types'
export function getPreviewSlotGroups(slots: PhotoSlot[]): PhotoSlot[][] {
  const half = slots.length / 2
  if (Number.isInteger(half) && half >= 3) {
    const offset = slots[half].x - slots[0].x
    if (offset > 0 && slots.slice(0, half).every((s, i) => { const twin = slots[i+half]; return twin.x-s.x === offset && twin.y === s.y && twin.width === s.width && twin.height === s.height && twin.rotation === s.rotation })) return slots.slice(0, half).map((s,i) => [s,slots[i+half]])
  }
  return slots.map(s => [s])
}
export function uniformPreviewRatio(slots: PhotoSlot[]): number | null {
  if (!slots.length) return null
  const ratio = slots[0].width/slots[0].height
  return Number.isFinite(ratio) && ratio > 0 && slots.every(s => Math.abs(s.width/s.height-ratio) < .002) ? ratio : null
}
export type RandomPreviewConfig = Pick<FrameLayout,'canvasWidth'|'canvasHeight'|'slots'|'frameLayers'|'backgroundColor'> & { photos: Pick<PreviewPoolPhoto,'id'|'imageUrl'>[] }
export function getRandomPreviewConfig(layout: FrameLayout): RandomPreviewConfig | null {
  if (layout.boothPreviewSource === 'prints') return null
  const ratio = uniformPreviewRatio(layout.slots)
  if (!ratio) return null
  const photos = Array.from(new Map((layout.previewPhotoPool || []).filter(p => Math.abs(p.aspectRatio-ratio) < .002).map(p => [p.imageUrl,p])).values())
  if (photos.length < getPreviewSlotGroups(layout.slots).length) return null
  return { canvasWidth:layout.canvasWidth,canvasHeight:layout.canvasHeight,slots:layout.slots,frameLayers:layout.frameLayers || [],backgroundColor:layout.backgroundColor,photos:photos.map(p=>({id:p.id,imageUrl:p.imageUrl})) }
}
export function pickRandomPhotos<T>(photos: T[], count: number, random = Math.random): T[] {
  if (count > photos.length) return []
  const shuffled = [...photos]
  for(let i=shuffled.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]] }
  return shuffled.slice(0,count)
}
export function validPoolPhoto(value: unknown, validUrl: (value: unknown) => boolean): value is PreviewPoolPhoto {
  if (!value || typeof value !== 'object') return false
  const p = value as PreviewPoolPhoto, c = p.crop
  return typeof p.id === 'string' && /^[\w-]{1,80}$/.test(p.id) && validUrl(p.imageUrl) && validUrl(p.originalUrl) &&
    Number.isFinite(p.originalWidth) && Number.isFinite(p.originalHeight) && p.originalWidth > 0 && p.originalHeight > 0 && p.originalWidth <= 30000 && p.originalHeight <= 30000 &&
    Boolean(c) && [c.x,c.y,c.width,c.height].every(Number.isFinite) && c.x>=0 && c.y>=0 && c.width>0 && c.height>0 && c.x+c.width<=p.originalWidth+1 && c.y+c.height<=p.originalHeight+1 && Number.isFinite(p.aspectRatio) && p.aspectRatio>0 && Math.abs(c.width/c.height-p.aspectRatio)<.02
}

import type { PhotoSlot } from './types'

export const WEDDING_SLOTS: PhotoSlot[] = [0, 1, 2].map(i => ({
  id: `wedding-photo-${i + 1}`, x: 36, y: 102 + i * 432, width: 528, height: 396,
  aspectRatio: '4:3', order: i, zIndex: 10 + i, rotation: 0,
}))
export const WEDDING_STYLES = [
  { id: 'vows', name: '작은 서약', description: '화이트 여백과 세이지 필기체', background: '#fffefa' },
  { id: 'letter', name: '우리의 편지', description: '따뜻한 아이보리와 단정한 명조', background: '#f7f3eb' },
  { id: 'garden', name: '초록 한 줄기', description: '작은 잎과 여백으로 담은 가든', background: '#fcfdf9' },
] as const
export type WeddingStyle = typeof WEDDING_STYLES[number]['id']
export interface WeddingOptions { style: WeddingStyle; names: string; date: string; title: string; accent: string; nameFont: 'serif' | 'sans' }
let fontsReady: Promise<void> | undefined
export function loadWeddingFonts() {
  if (!fontsReady) fontsReady = Promise.all([
    new FontFace('WeddingMyeongjo', 'url(/fonts/wedding/NanumMyeongjo-Regular.ttf)').load(),
    new FontFace('WeddingAllura', 'url(/fonts/wedding/Allura-Regular.ttf)').load(),
  ]).then(fonts => { fonts.forEach(font => document.fonts.add(font)) }).catch(error => { fontsReady = undefined; throw error })
  return fontsReady
}
function fitText(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, family: string, maxWidth = 500) {
  ctx.font = `${size}px ${family}`
  while (ctx.measureText(text).width > maxWidth && size > 18) ctx.font = `${--size}px ${family}`
  ctx.fillText(text, 300, y)
}
export async function drawWeddingFrame(canvas: HTMLCanvasElement, options: WeddingOptions, photos: (HTMLImageElement | null)[] = []) {
  await loadWeddingFonts()
  canvas.width = 600; canvas.height = 1800
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이 브라우저에서 이미지를 만들 수 없어요.')
  const style = WEDDING_STYLES.find(s => s.id === options.style) || WEDDING_STYLES[0]
  ctx.fillStyle = style.background; ctx.fillRect(0, 0, 600, 1800)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = options.accent
  fitText(ctx, options.title, 59, 39, 'WeddingAllura, WeddingMyeongjo')
  if (options.style === 'letter') {
    ctx.strokeStyle = options.accent; ctx.lineWidth = 1
    ctx.strokeRect(23, 23, 554, 1754)
  }
  if (options.style === 'garden') {
    ctx.strokeStyle = options.accent; ctx.fillStyle = options.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(270, 1437); ctx.quadraticCurveTo(310, 1410, 332, 1365); ctx.stroke()
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(286 + i * 10, 1424 - i * 15); ctx.rotate(i % 2 ? -.8 : .7)
      ctx.beginPath(); ctx.ellipse(i % 2 ? 9 : -9, -5, 6, 15, .4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
  } else {
    ctx.strokeStyle = options.accent; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(261, 1423); ctx.lineTo(339, 1423); ctx.stroke()
  }
  ctx.fillStyle = options.accent
  fitText(ctx, options.names, 1510, 42, options.nameFont === 'serif' ? 'WeddingMyeongjo' : 'sans-serif')
  fitText(ctx, options.date ? options.date.replaceAll('-', '. ') : '', 1583, 25, 'WeddingMyeongjo')
  fitText(ctx, 'Thank you for being with us', 1694, 30, 'WeddingAllura')
  // Cut holes LAST: no ornament, background or text can leak into a photo slot.
  for (let i = 0; i < WEDDING_SLOTS.length; i++) {
    const slot = WEDDING_SLOTS[i]
    ctx.clearRect(slot.x, slot.y, slot.width, slot.height)
    const image = photos[i]
    if (image) {
      ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.width, slot.height); ctx.clip()
      const scale = Math.max(slot.width / image.naturalWidth, slot.height / image.naturalHeight)
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale
      ctx.drawImage(image, slot.x + (slot.width - w) / 2, slot.y + (slot.height - h) / 2, w, h); ctx.restore()
    }
  }
}
export function weddingBundle(options: WeddingOptions, imageUrl: string) {
  return { format: 'phototoast-wedding-v1', name: `${options.names} · ${WEDDING_STYLES.find(s => s.id === options.style)?.name}`,
    printSize: '2x6', canvasWidth: 600, canvasHeight: 1800, dpi: 300, options,
    slots: WEDDING_SLOTS, backgroundColor: '#FFFFFF', backgroundColorCustomizable: false,
    frameLayers: [{ id: 'wedding-overlay', name: '웨딩 프레임', imageUrl, zIndex: 100, opacity: 1, visible: true }],
  }
}

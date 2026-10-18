import type { PhotoSlot } from './types'

export const WEDDING_SLOTS: PhotoSlot[] = [0, 1, 2].map(i => ({
  id: `wedding-photo-${i + 1}`, x: 36, y: 102 + i * 432, width: 528, height: 396,
  aspectRatio: '4:3', order: i, zIndex: 10 + i, rotation: 0,
}))
export const WEDDING_GROUPS = [
  { id: 'all', name: '전체' }, { id: 'minimal', name: '미니멀' },
  { id: 'type', name: '타이포' }, { id: 'line', name: '라인 드로잉' }, { id: 'nature', name: '내추럴' },
] as const
export const WEDDING_STYLES = [
  { id: 'vows', name: '작은 서약', description: '화이트 여백과 세이지 필기체', background: '#fffefa', group: 'minimal' },
  { id: 'letter', name: '우리의 편지', description: '아이보리 종이 위 얇은 테두리', background: '#f7f3eb', group: 'minimal' },
  { id: 'garden', name: '초록 한 줄기', description: '작은 잎 하나로 전하는 마음', background: '#fcfdf9', group: 'nature' },
  { id: 'editorial', name: '한 페이지', description: '정갈한 활자와 에디토리얼 여백', background: '#fffefa', group: 'type' },
  { id: 'ribbon', name: '가는 리본', description: '가느다란 리본 한 번의 매듭', background: '#fdfaf7', group: 'line' },
  { id: 'monogram', name: '두 글자의 약속', description: '두 사람 이름으로 만든 작은 인장', background: '#f8f6f0', group: 'type' },
  { id: 'gallery', name: '작은 갤러리', description: '사진을 위한 담백한 이중 라인', background: '#fffefa', group: 'minimal' },
  { id: 'olive', name: '올리브 노트', description: '좌우로 펼친 작은 올리브 가지', background: '#fafbf6', group: 'nature' },
  { id: 'signature', name: '우리의 서명', description: '크게 쓰고 조용히 남기는 서약', background: '#fffefa', group: 'type' },
  { id: 'heart', name: '마음 하나', description: '작은 하트와 넓은 여백', background: '#fcf8f6', group: 'line' },
  { id: 'midnight', name: '저녁의 서약', description: '딥 그린 위 따뜻한 크림 레터링', background: '#29382f', group: 'type' },
  { id: 'linen', name: '리넨 페이퍼', description: '웜 베이지와 가지런한 짧은 선', background: '#eee9df', group: 'minimal' },
  { id: 'petal', name: '꽃 한 송이', description: '가볍게 그린 작은 꽃의 윤곽', background: '#fffdf8', group: 'nature' },
  { id: 'arch', name: '나란한 곡선', description: '하단 이름을 감싸는 얇은 아치', background: '#faf8f3', group: 'line' },
  { id: 'orbit', name: '이어진 원', description: '두 개의 원으로 표현한 연결', background: '#fbfaf7', group: 'line' },
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
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const ink = options.style === 'midnight' ? '#f4efdf' : options.accent
  const family = options.nameFont === 'serif' ? 'WeddingMyeongjo' : 'sans-serif'
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, angle = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); ctx.stroke()
  }
  const branch = (direction: number) => {
    ctx.save(); ctx.translate(300, 1430); ctx.scale(direction, 1)
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(32, -9, 62, -42); ctx.stroke()
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(18 + i * 14, -10 - i * 11, 4, 12, i % 2 ? -.2 : 1.3, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 1.5
  const editorial = ['editorial', 'midnight', 'linen', 'monogram'].includes(options.style)
  fitText(ctx, options.title, 59, editorial ? 27 : 39, editorial ? 'WeddingMyeongjo' : 'WeddingAllura, WeddingMyeongjo')
  let nameY = 1510, dateY = 1583
  switch (options.style) {
    case 'letter':
      ctx.strokeRect(23, 23, 554, 1754)
      line(261, 1423, 339, 1423)
      break
    case 'garden':
      ctx.beginPath(); ctx.moveTo(270, 1437); ctx.quadraticCurveTo(310, 1410, 332, 1365); ctx.stroke()
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(286 + i * 10, 1424 - i * 15); ctx.rotate(i % 2 ? -.8 : .7)
        ctx.beginPath(); ctx.ellipse(i % 2 ? 9 : -9, -5, 6, 15, .4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      }
      break
    case 'editorial':
      line(80, 1406, 520, 1406)
      ctx.textAlign = 'left'; ctx.font = '19px WeddingMyeongjo'; ctx.fillText('THE WEDDING', 80, 1445)
      ctx.textAlign = 'center'; nameY = 1530; dateY = 1600
      line(80, 1650, 520, 1650)
      break
    case 'ribbon':
      ctx.beginPath(); ctx.moveTo(300, 1415); ctx.bezierCurveTo(210, 1360, 237, 1460, 300, 1415)
      ctx.bezierCurveTo(390, 1360, 363, 1460, 300, 1415); ctx.moveTo(297, 1418)
      ctx.quadraticCurveTo(282, 1445, 274, 1460); ctx.moveTo(303, 1418); ctx.quadraticCurveTo(316, 1440, 331, 1454); ctx.stroke()
      break
    case 'monogram': {
      const parts = options.names.trim().split(/[·♥&+\s]+/).filter(Boolean)
      const initials = parts.slice(0, 2).map(word => Array.from(word)[0]).join(' · ')
      ellipse(300, 1445, 45, 45)
      fitText(ctx, initials, 1445, 27, family, 74)
      nameY = 1545; dateY = 1615
      break
    }
    case 'gallery':
      ctx.strokeRect(24, 90, 552, 1284); ctx.strokeRect(29, 95, 542, 1274)
      fitText(ctx, 'A moment to remember', 1434, 31, 'WeddingAllura')
      break
    case 'olive': branch(-1); branch(1); break
    case 'signature':
      fitText(ctx, 'With love', 1430, 72, 'WeddingAllura')
      nameY = 1552; dateY = 1620
      break
    case 'heart':
      ctx.beginPath(); ctx.moveTo(300, 1440); ctx.bezierCurveTo(244, 1406, 284, 1380, 300, 1407)
      ctx.bezierCurveTo(316, 1380, 356, 1406, 300, 1440); ctx.stroke()
      break
    case 'midnight':
      line(36, 1398, 564, 1398); line(36, 1737, 564, 1737)
      fitText(ctx, 'TOGETHER', 1441, 21, 'WeddingMyeongjo')
      nameY = 1530; dateY = 1604
      break
    case 'linen':
      for (let i = 0; i < 5; i++) line(267 + i * 16, 1409, 267 + i * 16, 1430)
      line(36, 1740, 564, 1740)
      break
    case 'petal':
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5
        ellipse(300 + Math.sin(angle) * 17, 1409 + Math.cos(angle) * 17, 9, 17, -angle)
      }
      ellipse(300, 1409, 4, 4); line(300, 1436, 300, 1463)
      break
    case 'arch':
      ctx.beginPath(); ctx.moveTo(107, 1640); ctx.lineTo(107, 1525); ctx.bezierCurveTo(107, 1340, 493, 1340, 493, 1525); ctx.lineTo(493, 1640); ctx.stroke()
      nameY = 1528; dateY = 1602
      break
    case 'orbit': ellipse(283, 1420, 25, 25); ellipse(317, 1420, 25, 25); break
    default: line(261, 1423, 339, 1423)
  }
  ctx.fillStyle = ink
  fitText(ctx, options.names, nameY, options.style === 'signature' ? 36 : 42, family, options.style === 'arch' ? 340 : 500)
  fitText(ctx, options.date ? options.date.replaceAll('-', '. ') : '', dateY, 25, 'WeddingMyeongjo')
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

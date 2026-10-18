import type { PhotoSlot } from './types'

export const WEDDING_SLOTS: PhotoSlot[] = [0, 1, 2].map(i => ({
  id: `wedding-photo-${i + 1}`, x: 36, y: 102 + i * 432, width: 528, height: 396,
  aspectRatio: '4:3', order: i, zIndex: 10 + i, rotation: 0,
}))
export const WEDDING_GROUPS = [
  { id: 'all', name: '전체' }, { id: 'minimal', name: '미니멀' },
  { id: 'type', name: '타이포' }, { id: 'line', name: '라인 드로잉' }, { id: 'nature', name: '내추럴' },
  { id: 'vintage', name: '빈티지' }, { id: 'graphic', name: '그래픽' },
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
  { id: 'film', name: '필름 아카이브', description: '필름 가장자리와 작은 컷 넘버', background: '#272624', group: 'vintage' },
  { id: 'ticket', name: '오늘의 티켓', description: '한 장의 입장권으로 남기는 하루', background: '#f4eddd', group: 'vintage' },
  { id: 'newspaper', name: '우리의 소식', description: '신문의 단정한 활자와 가는 구분선', background: '#f3f0e7', group: 'type' },
  { id: 'calendar', name: '기억할 날짜', description: '예식일에 작은 원을 그린 달력', background: '#fffdf8', group: 'type' },
  { id: 'checker', name: '버터 체크', description: '크림 옐로와 작은 체크 패턴', background: '#fff7d8', group: 'graphic' },
  { id: 'cobalt', name: '블루 스튜디오', description: '선명한 블루와 대담한 그래픽', background: '#f6f8ff', group: 'graphic' },
  { id: 'terracotta', name: '테라코타', description: '따뜻한 색면과 정돈된 타이포', background: '#f1e5d9', group: 'graphic' },
  { id: 'postcard', name: '보내는 마음', description: '엽서의 우표와 손으로 쓴 인사', background: '#f6f0e4', group: 'vintage' },
  { id: 'typewriter', name: '타자기로 쓴 편지', description: '타자기 활자와 짧은 메모', background: '#f5f3ee', group: 'vintage' },
  { id: 'wave', name: '바다의 리듬', description: '페일 블루와 천천히 겹치는 물결', background: '#edf4f6', group: 'nature' },
  { id: 'spark', name: '작은 축제', description: '실버 그레이 위 네 갈래 반짝임', background: '#f0f1ef', group: 'line' },
  { id: 'rose', name: '로즈 타이포', description: '더스티 핑크와 큰 기울임 글자', background: '#f4e9e9', group: 'type' },
  { id: 'contour', name: '지형의 선', description: '종이 위 잔잔하게 흐르는 등고선', background: '#eeeee3', group: 'nature' },
  { id: 'museum', name: '우리라는 작품', description: '미술관 작품 라벨처럼 남긴 이름', background: '#f5f4ee', group: 'minimal' },
  { id: 'colorfield', name: '컬러 필드', description: '살구와 라벤더가 만나는 색면', background: '#f5eee7', group: 'graphic' },
] as const
export const MAX_PROPOSAL_DESIGNS = WEDDING_STYLES.length
export type WeddingStyle = typeof WEDDING_STYLES[number]['id']
export interface WeddingOptions { style: WeddingStyle; names: string; date: string; title: string; accent: string; nameFont: 'serif' | 'sans'; palette?: 'concept' | 'custom' }
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
  const conceptInks: Partial<Record<WeddingStyle, string>> = { ticket: '#66533d', newspaper: '#383833', calendar: '#5d6655', checker: '#7a6135', cobalt: '#2c46bc', terracotta: '#8a4838', postcard: '#6c5a43', typewriter: '#494b45', wave: '#536f81', spark: '#5c6561', rose: '#94566a', contour: '#64705b', museum: '#42473e', colorfield: '#665470' }
  const ink = ['midnight', 'film'].includes(options.style) ? '#f4efdf' : options.palette === 'concept' ? conceptInks[options.style] || '#687e61' : options.accent
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
  const editorial = !['vows', 'letter', 'garden', 'ribbon', 'gallery', 'olive', 'signature', 'heart', 'petal', 'arch', 'orbit', 'postcard', 'wave', 'rose'].includes(options.style)
  fitText(ctx, options.title, 59, editorial ? 27 : 39, editorial ? 'WeddingMyeongjo' : 'WeddingAllura, WeddingMyeongjo')
  let nameY = 1510, dateY = 1583, footerY = 1694, nameSize = 42, nameFamily = family
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
    case 'film':
      for (let y = 112; y < 1360; y += 62) { ctx.fillRect(10, y, 12, 27); ctx.fillRect(578, y, 12, 27) }
      ctx.font = '17px monospace'; ctx.textAlign = 'left'
      ;['01', '02', '03'].forEach((number, i) => ctx.fillText(number + ' / PHOTO TOAST', 42, 513 + i * 432))
      ctx.textAlign = 'center'; fitText(ctx, 'A DAY ON FILM', 1434, 22, 'monospace')
      line(36, 1741, 564, 1741)
      break
    case 'ticket':
      ctx.setLineDash([5, 8]); line(24, 1410, 576, 1410); ctx.setLineDash([])
      ctx.fillStyle = ink; fitText(ctx, 'ADMIT TWO / FOREVER', 1450, 21, 'monospace')
      ctx.fillStyle = style.background
      for (const x of [0, 600]) { ctx.beginPath(); ctx.arc(x, 1410, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      ctx.fillStyle = ink; nameY = 1530; dateY = 1600
      for (let i = 0; i < 31; i++) ctx.fillRect(218 + i * 5.3, 1726, i % 3 ? 2 : 3.5, i % 4 ? 26 : 35)
      break
    case 'newspaper':
      line(36, 1388, 564, 1388); line(36, 1395, 564, 1395)
      fitText(ctx, 'THE WEDDING POST', 1442, 34, 'WeddingMyeongjo')
      line(36, 1472, 564, 1472); nameY = 1535; dateY = 1600
      fitText(ctx, 'A NEW CHAPTER BEGINS', 1742, 17, 'monospace')
      break
    case 'calendar': {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(options.date)
      if (match) {
        const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
        const start = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
        fitText(ctx, `${year} / ${String(month).padStart(2, '0')}`, 1402, 22, 'monospace')
        ctx.font = '16px monospace'
        for (let d = 1; d <= days; d++) {
          const col = (start + d - 1) % 7, row = Math.floor((start + d - 1) / 7), x = 198 + col * 34, y = 1438 + row * 25
          if (d === day) ellipse(x, y, 12, 12)
          ctx.fillText(String(d), x, y)
        }
        nameY = 1623; dateY = 1671; footerY = 1740; nameSize = 36
      } else fitText(ctx, 'Save the date', 1438, 54, 'WeddingAllura')
      break
    }
    case 'checker':
      for (let y = 0; y < 2; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2 === 0) ctx.fillRect(220 + x * 16, 1408 + y * 16, 16, 16)
      line(36, 1737, 564, 1737); nameSize = 45
      break
    case 'cobalt':
      ctx.fillRect(36, 1395, 528, 75); ctx.save(); ctx.fillStyle = '#fffdf5'
      fitText(ctx, 'LOVE, IN GOOD COMPANY', 1434, 23, 'sans-serif'); ctx.restore()
      nameY = 1543; nameSize = 48; dateY = 1610
      ctx.fillRect(36, 1741, 95, 5); ctx.fillRect(469, 1741, 95, 5)
      break
    case 'terracotta':
      ctx.save(); ctx.globalAlpha = .11; ctx.fillRect(36, 1390, 528, 250); ctx.restore()
      fitText(ctx, 'A DAY TO KEEP', 1430, 21, 'WeddingMyeongjo')
      nameY = 1510; dateY = 1590
      ctx.beginPath(); ctx.arc(300, 1745, 18, Math.PI, 0); ctx.stroke()
      break
    case 'postcard':
      ctx.setLineDash([3, 4]); ctx.strokeRect(483, 1400, 66, 80); ctx.setLineDash([])
      ctx.save(); ctx.translate(516, 1440); ctx.rotate(-.25); ctx.font = '26px WeddingAllura'; ctx.fillText('Love', 0, 0); ctx.restore()
      ctx.textAlign = 'left'; ctx.font = '25px WeddingAllura'; ctx.fillText('To our favourite people,', 60, 1427); ctx.textAlign = 'center'
      line(90, 1640, 510, 1640); nameY = 1525; dateY = 1595
      break
    case 'typewriter':
      fitText(ctx, 'dear you,', 1425, 27, 'monospace')
      ctx.setLineDash([2, 7]); line(60, 1465, 540, 1465); ctx.setLineDash([])
      nameFamily = 'monospace, WeddingMyeongjo'; nameY = 1540; dateY = 1610
      fitText(ctx, 'a little note, a lasting memory.', 1746, 16, 'monospace')
      break
    case 'wave':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(178, 1412 + i * 13); ctx.bezierCurveTo(220, 1387 + i * 13, 252, 1440 + i * 13, 300, 1412 + i * 13)
        ctx.bezierCurveTo(345, 1386 + i * 13, 380, 1439 + i * 13, 422, 1412 + i * 13); ctx.stroke()
      }
      nameY = 1536; dateY = 1605
      break
    case 'spark':
      for (const [x, y, r] of [[300, 1425, 28], [255, 1410, 9], [341, 1440, 12]]) {
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + 2, y - 2, x + r, y)
        ctx.quadraticCurveTo(x + 2, y + 2, x, y + r); ctx.quadraticCurveTo(x - 2, y + 2, x - r, y)
        ctx.quadraticCurveTo(x - 2, y - 2, x, y - r); ctx.stroke()
      }
      break
    case 'rose':
      fitText(ctx, 'Love, always', 1445, 65, 'WeddingAllura')
      nameY = 1553; dateY = 1620; nameSize = 37
      line(285, 1741, 315, 1741)
      break
    case 'contour':
      ctx.save(); ctx.globalAlpha = .45
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(80, 1420 + i * 8); ctx.bezierCurveTo(170, 1380 + i * 8, 230, 1460 + i * 8, 300, 1420 + i * 8)
        ctx.bezierCurveTo(380, 1370 + i * 8, 450, 1450 + i * 8, 520, 1410 + i * 8); ctx.stroke()
      }
      ctx.restore(); nameY = 1540; dateY = 1610
      break
    case 'museum':
      line(78, 1402, 78, 1640)
      ctx.textAlign = 'left'; ctx.font = '18px monospace'; ctx.fillText('NO. 01 / A SHARED LIFE', 100, 1425); ctx.textAlign = 'center'
      nameY = 1515; dateY = 1583; nameSize = 35
      break
    case 'colorfield':
      ctx.save(); ctx.fillStyle = '#e5b9a1'; ctx.fillRect(36, 1388, 264, 85); ctx.fillStyle = '#c9bed7'; ctx.fillRect(300, 1388, 264, 85); ctx.restore()
      nameY = 1540; dateY = 1610; nameSize = 46
      break
    default: line(261, 1423, 339, 1423)
  }
  ctx.fillStyle = ink
  fitText(ctx, options.names, nameY, options.style === 'signature' ? 36 : nameSize, nameFamily, options.style === 'arch' ? 340 : options.style === 'museum' ? 360 : 500)
  fitText(ctx, options.date ? options.date.replaceAll('-', '. ') : '', dateY, 25, 'WeddingMyeongjo')
  fitText(ctx, 'Thank you for being with us', footerY, 30, 'WeddingAllura')
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

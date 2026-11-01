import type { QrPromoText } from './qrPromo'

/** 4×6, 300dpi usage sheet. All coordinates are in the 1200×1800 print canvas. */
export function drawQrUsageGuide(ctx: CanvasRenderingContext2D, copy: QrPromoText, font: string) {
  const ink = '#172C25', muted = '#46594F', green = '#254D3D'
  ctx.fillStyle = '#F7F7F0'
  ctx.fillRect(0, 0, 1200, 1800)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 28) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.fill()
  }
  const lines = (text: string, size: number, width: number) => {
    ctx.font = `600 ${size}px ${font}`
    const result: string[] = []
    let line = ''
    for (const char of text) {
      if (line && ctx.measureText(line + char).width > width) {
        const split = line.lastIndexOf(' ')
        if (split > 0) { result.push(line.slice(0, split)); line = line.slice(split + 1) + char }
        else { result.push(line); line = char }
      }
      else line += char
    }
    if (line) result.push(line)
    return result
  }
  const text = (value: string, x: number, y: number, size: number, width: number, color = ink, maxLines = 2) => {
    let actual = size
    let rows = lines(value, actual, width)
    while (rows.length > maxLines && actual > 16) { actual -= 2; rows = lines(value, actual, width) }
    ctx.fillStyle = color
    rows.forEach((row, i) => ctx.fillText(row, x, y + i * actual * 1.35))
    return y + rows.length * actual * 1.35
  }
  text(copy.title || '사진 인쇄 안내', 70, 66, 36, 1060, muted, 1)
  text('휴대폰 속 사진을, 한 장의 추억으로', 70, 132, 60, 1060, ink, 1)
  text('아래 순서대로 천천히 따라 해 주세요.', 70, 224, 40, 1060, muted, 1)

  const card = (number: string, y: number, height: number, title: string, detail: string) => {
    box(64, y, 1072, height, '#FFFFFF')
    box(96, y + 34, 72, 72, green, 36)
    text(number, 118, y + 47, 42, 60, '#FFFFFF', 1)
    const end = text(title, 194, y + 38, 56, 900, ink, 1)
    text(detail, 194, end + 22, 42, 880, muted)
  }
  card('1', 320, 280, copy.step1 || 'QR을 비추고 프레임을 고르세요', copy.detail1 || '카메라로 QR을 비춘 뒤, 화면에 뜨는 주소를 눌러 주세요.')
  card('2', 626, 640, copy.step2 || '사진을 고르고 위치를 맞추세요', copy.detail2 || '사진을 넣을 칸을 누른 뒤 ‘휴대폰 사진 고르기’를 눌러 주세요.')

  box(96, 888, 1008, 342, '#EDF2EC', 20)
  text('사진 고르는 화면이 나오면', 126, 918, 40, 940, green, 1)
  text('사진 목록이 바로 보이나요?', 126, 982, 44, 940, ink, 1)
  text('→ 원하는 사진을 누르세요.', 126, 1040, 42, 940, muted, 1)
  text('‘파일 선택’이라고 나오나요?', 126, 1110, 44, 940, ink, 1)
  text('→ ‘갤러리’ 또는 ‘사진’을 누르세요.', 126, 1168, 42, 940, muted, 1)

  card('3', 1292, 280, copy.step3 || '카운터에 화면을 보여 주세요', copy.detail3 || '사진 선택을 마치면 직원에게 화면을 보여 주세요. 인쇄를 안내해 드려요.')
  text(copy.contact || '선택이 어려우시면 카운터에 말씀해 주세요.', 96, 1624, 44, 1008, green, 1)
  text('갤러리가 안 보이면 왼쪽 위 메뉴나 ‘더보기’를 확인해 주세요.', 96, 1696, 32, 1008, muted, 1)
}

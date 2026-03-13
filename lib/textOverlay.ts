import sharp from 'sharp'
import { KOREAN_FONT_FAMILY } from './setupFonts'

/**
 * 텍스트 오버레이 PNG 생성기
 *
 * 인스타 스토리 스타일의 텍스트를 투명 배경 PNG로 생성합니다.
 * 생성된 PNG는 프레임 레이어로 추가하여 에디터에서 위치/크기/회전 조절 가능합니다.
 */

export type TextBgStyle = 'none' | 'solid' | 'translucent'
export type TextAlign = 'left' | 'center' | 'right'

export interface TextOverlayOptions {
  text: string
  fontSize?: number          // 기본: 64
  color?: string             // 텍스트 색상 (기본: #FFFFFF)
  bgStyle?: TextBgStyle      // 배경 스타일 (기본: none)
  bgColor?: string           // 배경 색상 (기본: #000000)
  align?: TextAlign           // 정렬 (기본: center)
  bold?: boolean              // 볼드 (기본: true)
  fontFamily?: string
  maxWidth?: number           // 최대 너비 (기본: 1000)
}

// 인스타 스토리 스타일 색상 프리셋
export const TEXT_COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#ED4956', '#E1306C',
  '#833AB4', '#405DE6', '#5B51D8', '#00B2FF',
  '#58C322', '#FCAF45', '#F77737', '#FD1D1D',
]

export async function generateTextOverlay(options: TextOverlayOptions): Promise<Buffer> {
  const {
    text,
    fontSize = 64,
    color = '#FFFFFF',
    bgStyle = 'none',
    bgColor = '#000000',
    align = 'center',
    bold = true,
    fontFamily = KOREAN_FONT_FAMILY,
    maxWidth = 1000,
  } = options

  const lines = text.split('\n')
  const lineHeight = fontSize * 1.4
  const padding = bgStyle !== 'none' ? Math.round(fontSize * 0.5) : 0
  const lineSpacing = bgStyle !== 'none' ? 8 : 0 // 배경 있을 때 줄 간격

  // 텍스트 크기 추정 (한글은 폭이 넓음)
  const estimateWidth = (str: string) => {
    let w = 0
    for (const ch of str) {
      // 한글/CJK는 fontSize 만큼, 영문/숫자는 0.6배
      w += ch.charCodeAt(0) > 0x2E80 ? fontSize : fontSize * 0.6
    }
    return w
  }

  const textWidths = lines.map(l => estimateWidth(l))
  const maxTextWidth = Math.min(Math.max(...textWidths), maxWidth)
  const totalWidth = maxTextWidth + padding * 2
  const totalHeight = lines.length * (lineHeight + lineSpacing) - lineSpacing + padding * 2

  // 배경 관련
  const bgOpacity = bgStyle === 'solid' ? 1 : bgStyle === 'translucent' ? 0.6 : 0
  const borderRadius = Math.round(fontSize * 0.3)

  // 텍스트 앵커
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
  const textX = align === 'left' ? padding : align === 'right' ? totalWidth - padding : totalWidth / 2

  const textLines = lines.map((line, i) => {
    const y = padding + fontSize + i * (lineHeight + lineSpacing)

    if (bgStyle !== 'none') {
      // 각 줄마다 개별 배경
      const lw = estimateWidth(line)
      const bgW = lw + padding * 1.2
      const bgH = lineHeight + 4
      const bgX = align === 'left' ? padding - padding * 0.6 : align === 'right' ? totalWidth - padding - bgW + padding * 0.6 : (totalWidth - bgW) / 2
      const bgY = y - fontSize + (lineHeight - bgH) / 2 - 2
      return `
        <rect x="${bgX}" y="${bgY}" width="${bgW}" height="${bgH}" rx="${borderRadius}" fill="${bgColor}" fill-opacity="${bgOpacity}"/>
        <text x="${textX}" y="${y}" font-size="${fontSize}" font-weight="${bold ? '700' : '400'}" fill="${color}" text-anchor="${anchor}">${escapeXml(line)}</text>`
    }

    return `<text x="${textX}" y="${y}" font-size="${fontSize}" font-weight="${bold ? '700' : '400'}" fill="${color}" text-anchor="${anchor}">${escapeXml(line)}</text>`
  }).join('\n')

  const svg = `
<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>text { font-family: ${fontFamily}; }</style>
  </defs>
  ${textLines}
</svg>`

  const buffer = await sharp(Buffer.from(svg), { density: 72 })
    .resize(Math.round(totalWidth), Math.round(totalHeight))
    .ensureAlpha()
    .png()
    .toBuffer()

  return buffer
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

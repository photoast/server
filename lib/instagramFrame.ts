import sharp from 'sharp'
import QRCode from 'qrcode'
import { KOREAN_FONT_FAMILY } from './setupFonts'

/**
 * 인스타그램 스타일 프레임 생성기
 *
 * 1200×1800 (4×6 @ 300dpi) 캔버스에 실제 인스타그램 포스트처럼 보이는 프레임 오버레이를 생성합니다.
 * 인스타 시그니처 그라데이션 배경 적용 (보라 → 핑크 → 오렌지)
 *
 * 구성:
 *   [상단 헤더] 프로필 원 + 아이디 + ··· 메뉴
 *   [사진 영역] 풀 너비, 최대한 크게
 *   [액션 바]   ♡ 💬 ✈ ... 🔖
 *   [하단 정보] 좋아요 + 아이디 캡션 + QR코드
 */

const W = 1200
const H = 1800

// ---- 레이아웃 수치 ----
const SIDE_PAD = 24
const HEADER_H = 100
const ACTION_H = 90
const BOTTOM_H = 186

const PHOTO_Y = HEADER_H
const PHOTO_H = H - HEADER_H - ACTION_H - BOTTOM_H  // 1424
const PHOTO_X = 0
const PHOTO_W = W

const ACTION_Y = PHOTO_Y + PHOTO_H
const BOTTOM_Y = ACTION_Y + ACTION_H

// ---- 인스타 피드 색상 (흰색 배경) ----
const BG_COLOR = '#FFFFFF'
const TEXT_PRIMARY = '#262626'
const TEXT_SECONDARY = '#8E8E8E'
const ICON_COLOR = '#262626'
const BORDER_COLOR = '#EFEFEF'

// ---- SVG 아이콘 ----
const HEART_PATH = `M13 22.874C6.618 19.124 1.5 14.524 1.5 9.1 1.5 5.082 4.582 2 8.6 2c2.206 0 3.879 1.009 4.4 1.508C13.521 3.01 15.194 2 17.4 2 21.418 2 24.5 5.082 24.5 9.1c0 5.424-5.118 10.024-11.5 13.774z`
const COMMENT_PATH = `M13 1C6.373 1 1 5.373 1 10.5c0 2.832 1.508 5.368 3.876 7.088L3.5 23l5.578-2.458C10.278 20.846 11.618 21 13 21c6.627 0 12-4.373 12-9.5S19.627 1 13 1z`
const SHARE_PATH = `M22.707 11.293l-9-9A1 1 0 0012 3v4.263c-7.5.829-12 7.237-12 14.237 0 .164.008.328.023.49A1 1 0 001.991 22c1.821-3.662 5.436-6 9.509-6H12v4a1 1 0 001.707.707l9-9a1 1 0 000-1.414z`
const BOOKMARK_PATH = `M5 1V24.074l8-5.471 8 5.471V1z`

const MORE_DOTS = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ICON_COLOR}"/>
   <circle cx="${cx + r * 3.5}" cy="${cy}" r="${r}" fill="${ICON_COLOR}"/>
   <circle cx="${cx + r * 7}" cy="${cy}" r="${r}" fill="${ICON_COLOR}"/>`

export interface InstagramFrameOptions {
  username: string
  qrUrl?: string
  caption?: string       // 캡션 텍스트 (기본: "사진을 찍었어요")
  likesText?: string     // 좋아요 텍스트 (기본: "좋아요 999개")
  qrLabel?: string       // QR 라벨 (기본: "QR로 팔로우")
  fontFamily?: string
}

export async function generateInstagramFrame(options: InstagramFrameOptions): Promise<Buffer> {
  const {
    username,
    qrUrl,
    caption = '사진을 찍었어요',
    likesText = '좋아요 999개',
    qrLabel = 'QR로 팔로우',
    fontFamily = KOREAN_FONT_FAMILY,
  } = options

  const cleanName = username.replace(/^@/, '')
  const igUrl = qrUrl || `https://www.instagram.com/${cleanName}`

  // QR 코드 SVG 생성 (흰색 모듈, 투명 배경)
  const qrSvgStr = await QRCode.toString(igUrl, {
    type: 'svg',
    margin: 0,
    color: { dark: '#262626', light: '#00000000' },
  })
  const viewBoxMatch = qrSvgStr.match(/viewBox="0 0 (\d+) (\d+)"/)
  const qrNativeSize = viewBoxMatch ? parseInt(viewBoxMatch[1]) : 33
  const qrInner = qrSvgStr
    .replace(/<\?xml[^?]*\?>\s*/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')

  // ---- 헤더 수치 ----
  const profileR = 30
  const profileCX = SIDE_PAD + 16 + profileR
  const profileCY = HEADER_H / 2
  const headerTextX = profileCX + profileR + 18
  const headerTextY = profileCY + 10

  // ---- 액션 바 아이콘 수치 ----
  const iconScale = 1.25
  const iconY = ACTION_Y + (ACTION_H - 26 * iconScale) / 2
  const iconGap = 46 * iconScale
  const heartX = SIDE_PAD + 16
  const commentX = heartX + iconGap
  const shareX = commentX + iconGap
  const bookmarkX = W - SIDE_PAD - 16 - 26 * iconScale

  // ---- 하단 정보 수치 ----
  const likesY = BOTTOM_Y + 42
  const captionY = likesY + 46
  const qrDisplaySize = 140
  const qrScale = qrDisplaySize / qrNativeSize
  const qrX = W - SIDE_PAD - 16 - qrDisplaySize
  const qrY = BOTTOM_Y + (BOTTOM_H - qrDisplaySize) / 2 - 6

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      text { font-family: ${fontFamily}; }
    </style>
    <!-- 스토리 링 그라데이션 -->
    <linearGradient id="igRing" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFC107"/>
      <stop offset="50%" stop-color="#F44336"/>
      <stop offset="100%" stop-color="#9C27B0"/>
    </linearGradient>
  </defs>

  <!-- ===== 상단 헤더 ===== -->
  <rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${BG_COLOR}"/>

  <!-- 헤더 하단 보더 -->
  <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${BORDER_COLOR}" stroke-width="1"/>

  <!-- 프로필 사진 원 (스토리 링) -->
  <circle cx="${profileCX}" cy="${profileCY}" r="${profileR + 4}" fill="none" stroke="url(#igRing)" stroke-width="3"/>
  <circle cx="${profileCX}" cy="${profileCY}" r="${profileR}" fill="#EFEFEF" stroke="${BG_COLOR}" stroke-width="3"/>
  <circle cx="${profileCX}" cy="${profileCY - 4}" r="10" fill="#C7C7C7"/>
  <ellipse cx="${profileCX}" cy="${profileCY + 18}" rx="16" ry="10" fill="#C7C7C7"/>

  <!-- 유저네임 -->
  <text x="${headerTextX}" y="${headerTextY}" font-size="32" font-weight="600" fill="${TEXT_PRIMARY}">${escapeXml(cleanName)}</text>

  <!-- ··· 메뉴 -->
  ${MORE_DOTS(W - SIDE_PAD - 56, profileCY, 4)}

  <!-- ===== 하단 영역 ===== -->
  <rect x="0" y="${ACTION_Y}" width="${W}" height="${ACTION_H + BOTTOM_H}" fill="${BG_COLOR}"/>

  <!-- 액션바 상단 보더 -->
  <line x1="0" y1="${ACTION_Y}" x2="${W}" y2="${ACTION_Y}" stroke="${BORDER_COLOR}" stroke-width="1"/>

  <!-- ===== 액션 바 ===== -->
  <g transform="translate(${heartX}, ${iconY}) scale(${iconScale})">
    <path d="${HEART_PATH}" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g transform="translate(${commentX}, ${iconY}) scale(${iconScale})">
    <path d="${COMMENT_PATH}" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g transform="translate(${shareX}, ${iconY}) scale(${iconScale})">
    <path d="${SHARE_PATH}" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g transform="translate(${bookmarkX}, ${iconY}) scale(${iconScale})">
    <path d="${BOOKMARK_PATH}" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linejoin="round"/>
  </g>

  <!-- ===== 하단 정보 ===== -->
  <text x="${SIDE_PAD + 16}" y="${likesY}" font-size="28" font-weight="600" fill="${TEXT_PRIMARY}">${escapeXml(likesText)}</text>

  <text x="${SIDE_PAD + 16}" y="${captionY}" font-size="28" fill="${TEXT_PRIMARY}">
    <tspan font-weight="600">${escapeXml(cleanName)}</tspan>
    <tspan fill="${TEXT_SECONDARY}">  ${escapeXml(caption)}</tspan>
  </text>

  <!-- QR 코드 -->
  <g transform="translate(${qrX}, ${qrY}) scale(${qrScale.toFixed(4)})">
    ${qrInner}
  </g>
  <text x="${qrX + qrDisplaySize / 2}" y="${qrY + qrDisplaySize + 28}" font-size="18" fill="${TEXT_SECONDARY}" text-anchor="middle">${escapeXml(qrLabel)}</text>

</svg>`

  // 1) SVG → 풀사이즈 PNG (사진 영역 포함 전체 렌더)
  const fullPng = await sharp(Buffer.from(svg), { density: 72 })
    .resize(W, H)
    .ensureAlpha()
    .png()
    .toBuffer()

  // 2) 사진 영역을 투명하게 만드는 마스크 (흰 = 보임, 검 = 투명)
  const maskSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO_W}" height="${PHOTO_H}" fill="black"/>
</svg>`

  const mask = await sharp(Buffer.from(maskSvg), { density: 72 })
    .resize(W, H)
    .grayscale()
    .toBuffer()

  // 마스크를 알파 채널로 적용
  const buffer = await sharp(fullPng)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return buffer
}

/** XML 특수문자 이스케이프 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 인스타그램 레이아웃의 사진 슬롯 좌표 (외부에서 사용 가능) */
export const INSTAGRAM_SLOT = {
  x: PHOTO_X,
  y: PHOTO_Y,
  width: PHOTO_W,
  height: PHOTO_H,
} as const

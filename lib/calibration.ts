import sharp from 'sharp'

/**
 * 프린터 캘리브레이션 테스트 패턴 이미지 생성
 *
 * 1200×1800 (4×6 @ 300dpi) 이미지에 다음 요소를 그립니다:
 * - 테두리 사각형 (잘림 감지용)
 * - 5% 간격 눈금선 + 레이블
 * - 코너 마커 (L자 모양)
 * - 중심 십자선
 * - 현재 보정값 표시
 */
export async function generateCalibrationImage(options?: {
  shrinkPercent?: number
  verticalOffsetPx?: number
}): Promise<Buffer> {
  const W = 1200
  const H = 1800
  const shrink = options?.shrinkPercent ?? 97.5
  const vOffset = options?.verticalOffsetPx ?? 0

  // SVG로 캘리브레이션 패턴 생성
  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      text { font-family: monospace; }
    </style>
  </defs>

  <!-- 배경: 흰색 -->
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>

  <!-- 외곽 테두리 (1px, 정확히 가장자리) -->
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#000000" stroke-width="2"/>

  <!-- 5% 안쪽 테두리 (잘림 감지 기준선) -->
  <rect x="${W * 0.05}" y="${H * 0.05}" width="${W * 0.9}" height="${H * 0.9}" fill="none" stroke="#FF0000" stroke-width="1.5" stroke-dasharray="8,4"/>

  <!-- 10% 안쪽 테두리 -->
  <rect x="${W * 0.1}" y="${H * 0.1}" width="${W * 0.8}" height="${H * 0.8}" fill="none" stroke="#0066FF" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- 수평 눈금선 (5% 간격) -->
  ${Array.from({ length: 19 }, (_, i) => {
    const pct = (i + 1) * 5
    const y = Math.round(H * pct / 100)
    const isMain = pct % 10 === 0
    return `
    <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${isMain ? '#999999' : '#CCCCCC'}" stroke-width="${isMain ? 1 : 0.5}" stroke-dasharray="${isMain ? '6,3' : '2,4'}"/>
    <text x="8" y="${y - 4}" font-size="16" fill="#666666">${pct}%</text>
    <text x="${W - 8}" y="${y - 4}" font-size="16" fill="#666666" text-anchor="end">${pct}%</text>`
  }).join('')}

  <!-- 수직 눈금선 (5% 간격) -->
  ${Array.from({ length: 19 }, (_, i) => {
    const pct = (i + 1) * 5
    const x = Math.round(W * pct / 100)
    const isMain = pct % 10 === 0
    return `
    <line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${isMain ? '#999999' : '#CCCCCC'}" stroke-width="${isMain ? 1 : 0.5}" stroke-dasharray="${isMain ? '6,3' : '2,4'}"/>
    <text x="${x + 4}" y="16" font-size="14" fill="#666666">${pct}%</text>`
  }).join('')}

  <!-- 중심 십자선 -->
  <line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#FF0000" stroke-width="1"/>
  <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#FF0000" stroke-width="1"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="20" fill="none" stroke="#FF0000" stroke-width="2"/>

  <!-- 코너 마커 (L자) -->
  <!-- 좌상 -->
  <line x1="0" y1="60" x2="0" y2="0" stroke="#000000" stroke-width="6"/>
  <line x1="0" y1="0" x2="60" y2="0" stroke="#000000" stroke-width="6"/>
  <!-- 우상 -->
  <line x1="${W}" y1="60" x2="${W}" y2="0" stroke="#000000" stroke-width="6"/>
  <line x1="${W}" y1="0" x2="${W - 60}" y2="0" stroke="#000000" stroke-width="6"/>
  <!-- 좌하 -->
  <line x1="0" y1="${H - 60}" x2="0" y2="${H}" stroke="#000000" stroke-width="6"/>
  <line x1="0" y1="${H}" x2="60" y2="${H}" stroke="#000000" stroke-width="6"/>
  <!-- 우하 -->
  <line x1="${W}" y1="${H - 60}" x2="${W}" y2="${H}" stroke="#000000" stroke-width="6"/>
  <line x1="${W}" y1="${H}" x2="${W - 60}" y2="${H}" stroke="#000000" stroke-width="6"/>

  <!-- 타이틀 -->
  <rect x="${W / 2 - 260}" y="100" width="520" height="100" rx="12" fill="#FFFFFF" fill-opacity="0.9" stroke="#333333" stroke-width="1"/>
  <text x="${W / 2}" y="140" font-size="36" font-weight="bold" fill="#000000" text-anchor="middle">CALIBRATION TEST</text>
  <text x="${W / 2}" y="178" font-size="22" fill="#666666" text-anchor="middle">${W}×${H} (4×6 @ 300dpi)</text>

  <!-- 현재 보정값 표시 -->
  <rect x="${W / 2 - 220}" y="${H - 250}" width="440" height="140" rx="12" fill="#F5F5F5" stroke="#CCCCCC" stroke-width="1"/>
  <text x="${W / 2}" y="${H - 210}" font-size="20" font-weight="bold" fill="#333333" text-anchor="middle">현재 보정 설정</text>
  <text x="${W / 2}" y="${H - 175}" font-size="24" fill="#0066FF" text-anchor="middle">SHRINK: ${shrink}%</text>
  <text x="${W / 2}" y="${H - 142}" font-size="24" fill="#0066FF" text-anchor="middle">V-OFFSET: ${vOffset}px</text>

  <!-- 가장자리 체크 패턴 (각 변 중앙에 화살표 + 거리 표시) -->
  <!-- 상단 -->
  <text x="${W / 2}" y="50" font-size="28" font-weight="bold" fill="#FF0000" text-anchor="middle">▲ TOP</text>
  <!-- 하단 -->
  <text x="${W / 2}" y="${H - 30}" font-size="28" font-weight="bold" fill="#FF0000" text-anchor="middle">▼ BOTTOM</text>
  <!-- 좌측 -->
  <text x="20" y="${H / 2}" font-size="28" font-weight="bold" fill="#FF0000" transform="rotate(-90, 30, ${H / 2})">◀ LEFT</text>
  <!-- 우측 -->
  <text x="${W - 20}" y="${H / 2}" font-size="28" font-weight="bold" fill="#FF0000" transform="rotate(90, ${W - 30}, ${H / 2})">▶ RIGHT</text>
</svg>`

  const buffer = await sharp(Buffer.from(svg))
    .jpeg({ quality: 100 })
    .toBuffer()

  return buffer
}

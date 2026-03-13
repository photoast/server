import path from 'path'
import fs from 'fs'

/**
 * Vercel(Linux) 환경에서 한글 폰트가 없어 SVG → PNG 렌더링 시 한글이 깨지는 문제 해결.
 * fontconfig에 Noto Sans KR 폰트 경로를 등록합니다.
 *
 * 이 모듈을 import하면 자동으로 실행됩니다.
 */

let initialized = false

export function ensureFonts() {
  if (initialized) return
  initialized = true

  // Next.js 빌드 후 __dirname은 .next/server/chunks 등이 될 수 있으므로 여러 경로 시도
  const candidates = [
    path.join(__dirname, 'fonts'),
    path.join(process.cwd(), 'lib', 'fonts'),
    path.join(process.cwd(), '.next', 'server', 'lib', 'fonts'),
  ]

  const fontDir = candidates.find(d => fs.existsSync(d))
  if (!fontDir) {
    console.warn('[Fonts] Noto Sans KR font directory not found. Korean text may not render correctly.')
    return
  }

  // fontconfig 설정 파일 생성
  const fcConfigPath = '/tmp/fonts.conf'
  if (!fs.existsSync(fcConfigPath)) {
    try {
      fs.writeFileSync(fcConfigPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
</fontconfig>`)
    } catch {
      // /tmp 쓰기 실패 시 무시
      return
    }
  }

  process.env.FONTCONFIG_FILE = fcConfigPath
  console.log(`[Fonts] fontconfig configured: ${fontDir}`)
}

// 자동 실행
ensureFonts()

export const KOREAN_FONT_FAMILY = '"Noto Sans KR", "Noto Sans CJK KR", sans-serif'

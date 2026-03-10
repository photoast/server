/**
 * 인스타그램 스타일 프레임 PNG 생성 스크립트
 *
 * 사용법:
 *   npx tsx scripts/generate-instagram-frame.ts --username your_id
 *   npx tsx scripts/generate-instagram-frame.ts --username your_id --qr-url https://example.com
 *   npx tsx scripts/generate-instagram-frame.ts --username your_id --output ./my-frame.png
 */

import path from 'path'
import fs from 'fs'
import { generateInstagramFrame } from '../lib/instagramFrame'

async function main() {
  const args = process.argv.slice(2)

  let username = ''
  let qrUrl = ''
  let output = ''

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--username':
      case '-u':
        username = args[++i]
        break
      case '--qr-url':
        qrUrl = args[++i]
        break
      case '--output':
      case '-o':
        output = args[++i]
        break
    }
  }

  if (!username) {
    console.error('사용법: npx tsx scripts/generate-instagram-frame.ts --username <인스타아이디>')
    console.error('옵션:')
    console.error('  --username, -u   인스타그램 아이디 (필수)')
    console.error('  --qr-url         QR코드 URL (기본: instagram.com/<아이디>)')
    console.error('  --output, -o     출력 파일 경로 (기본: public/uploads/instagram-frame-<아이디>.png)')
    process.exit(1)
  }

  const cleanUsername = username.replace(/^@/, '')
  const outputPath = output || path.join(process.cwd(), 'public', 'uploads', `instagram-frame-${cleanUsername}.png`)

  // 출력 디렉토리 확인
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  console.log(`인스타그램 프레임 생성 중...`)
  console.log(`  아이디: @${cleanUsername}`)
  console.log(`  QR URL: ${qrUrl || `https://www.instagram.com/${cleanUsername}`}`)

  const buffer = await generateInstagramFrame({
    username: cleanUsername,
    qrUrl: qrUrl || undefined,
  })

  fs.writeFileSync(outputPath, buffer)
  console.log(`\n프레임 생성 완료: ${outputPath}`)
  console.log(`파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`)
}

main().catch(err => {
  console.error('프레임 생성 실패:', err)
  process.exit(1)
})

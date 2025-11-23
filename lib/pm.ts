// printCalibration4x6.ts
// EPSON PM-401 4×6 Borderless Calibration Printer
// TypeScript + sharp + ipp
// 역보정(SHRINK_PERCENT) + 세로 위치 오프셋(VERTICAL_OFFSET_PX) 적용

import fs from "fs"
import path from "path"
import sharp from "sharp"
import https from "https"

// @ts-ignore (ipp에 타입 없음)
import ipp from "ipp"

// =============================================
// 환경설정 (필요하면 값 고정도 가능)
// =============================================
const SHRINK_PERCENT = Number(process.env.SHRINK_PERCENT || "95.25")
const SHRINK_SCALE = SHRINK_PERCENT / 100

const VERTICAL_OFFSET_PX = Number(process.env.VERTICAL_OFFSET_PX || "-5")

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 1800

// =============================================
// 4×6 무테 인쇄용 IPP 속성
// =============================================
function get4x6BorderlessAttributes() {
  return {
    media: "na_index-4x6_4x6in",

    "media-col": {
      "media-size": {
        // 4×6 inch → mm 로 변환한 IPP 단위 (1/100mm)
        "x-dimension": 10160, // 101.6mm
        "y-dimension": 15240, // 152.4mm
      },

      "media-type": "photographic-glossy",

      "media-top-margin": 0,
      "media-left-margin": 0,
      "media-right-margin": 0,
      "media-bottom-margin": 0,

      "media-source": "main",
    },

    copies: 1,
    "print-quality": 5,
    "print-color-mode": "color",
    "orientation-requested": 3,
  }
}

// =============================================
// PNG/JPG 이미지 → 4×6 보정 JPEG 변환
// =============================================
async function buildCorrected4x6Image(imagePath: string): Promise<Buffer> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`이미지 파일 없음: ${imagePath}`)
  }

  console.log("=== 이미지 처리 시작 ===")
  console.log(`- 원본: ${imagePath}`)
  console.log(`- SHRINK_PERCENT: ${SHRINK_PERCENT}%`)
  console.log(`- VERTICAL_OFFSET_PX: ${VERTICAL_OFFSET_PX}px`)

  // 1) 원본 → shrink 적용 크기 계산
  const targetW = Math.round(CANVAS_WIDTH * SHRINK_SCALE)
  const targetH = Math.round(CANVAS_HEIGHT * SHRINK_SCALE)

  console.log(`- 축소 크기: ${targetW}×${targetH}`)

  const resized = await sharp(imagePath)
    .resize(targetW, targetH, { fit: "cover", background: "#ffffff" })
    .toBuffer()

  // 2) 4×6 캔버스에 중앙정렬 + 세로 오프셋 적용하여 합성
  const left = Math.round((CANVAS_WIDTH - targetW) / 2)
  const top = Math.round((CANVAS_HEIGHT - targetH) / 2 + VERTICAL_OFFSET_PX)

  console.log(`- 합성 위치: left=${left}, top=${top}`)

  const finalJpeg = await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 95 })
    .toBuffer()

  console.log(
    `- 최종 JPEG 크기: ${(finalJpeg.length / 1024).toFixed(1)} KB`
  )

  return finalJpeg
}

// =============================================
// IPP Print-Job 수행
// =============================================
export async function sendIPP(printUrl: string, jpegBuffer: Buffer): Promise<{ success: boolean; error?: string }> {
  console.log("\n=== IPP Print-Job 시작 ===")
  console.log(`Printer: ${printUrl}`)

  const isSecure =
    printUrl.startsWith("https://") || printUrl.startsWith("ipps://")

  const httpsAgent = new https.Agent({ rejectUnauthorized: false })

  const printer = new ipp.Printer(printUrl, {
    agent: isSecure ? httpsAgent : undefined,
  })

  const jobAttrs = get4x6BorderlessAttributes()

  const msg = {
    "operation-attributes-tag": {
      "requesting-user-name": "photoast-ts",
      "job-name": `Photoast-Calib (shrink=${SHRINK_PERCENT}%, offset=${VERTICAL_OFFSET_PX}px)`,
      "document-format": "image/jpeg",
    },
    "job-attributes-tag": jobAttrs,
    data: jpegBuffer,
  }

  return new Promise((resolve, reject) => {
    printer.execute('Print-Job', msg, (err: any, res: any) => {
        console.log(`\n=== Raw Callback Response ===`)
        console.log(`err:`, err)
        console.log(`res:`, res)

        if (err) {
          resolve({ success: false, error: err.message })
          return
        }

        const ok = [
          'successful-ok',
          'successful-ok-ignored-or-substituted-attributes',
          'successful-ok-conflicting-attributes',
        ]

        const success = typeof res.statusCode === 'string'
          ? ok.includes(res.statusCode)
          : res.statusCode >= 0 && res.statusCode <= 0x00ff

        resolve({
          success,
          error: success ? undefined : res.statusCode,
        })
      })
  })
}

// =============================================
// 외부에서 호출할 단일 함수
// =============================================
export async function printCalibration4x6(printUrl: string, imagePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("\n==============")
    console.log(" Photoast Print Module (TS)")
    console.log("==============")

    const jpeg = await buildCorrected4x6Image(imagePath)

    // 미리보기 파일 저장
    const outDir = path.join(process.cwd(), "output")
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const outPath = path.join(
      outDir,
      `preview-4x6-shrink-${SHRINK_PERCENT}-offset-${VERTICAL_OFFSET_PX}.jpg`
    )
    fs.writeFileSync(outPath, jpeg)
    console.log(`미리보기 JPEG 저장됨: ${outPath}`)

    // IPP 전송
    const result = await sendIPP(printUrl, jpeg)
    return result
  } catch (err) {
    console.error("✗ 오류:", err)
    throw err
  }
}

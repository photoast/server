import sharp from "sharp"

/**
 * Printer calibration correction settings
 *
 * SHRINK_PERCENT: Compensates for printer's borderless expansion
 * VERTICAL_OFFSET_PX: Adjusts vertical position to compensate for printer offset
 */
const DEFAULT_SHRINK_PERCENT = Number(process.env.SHRINK_PERCENT || "95.25")
const DEFAULT_VERTICAL_OFFSET_PX = Number(process.env.VERTICAL_OFFSET_PX || "-5")

export interface CorrectionOptions {
  shrinkPercent?: number
  verticalOffsetPx?: number
  canvasWidth?: number
  canvasHeight?: number
  backgroundColor?: string
}

/**
 * Apply printer correction to image
 *
 * This applies shrink and vertical offset corrections to compensate for
 * printer's borderless printing behavior (expansion and position shift).
 *
 * @param imageBuffer - Input image buffer (should be already processed to target size)
 * @param options - Correction options
 * @returns Corrected image buffer
 */
export async function applyPrinterCorrection(
  imageBuffer: Buffer,
  options: CorrectionOptions = {}
): Promise<Buffer> {
  const {
    shrinkPercent = DEFAULT_SHRINK_PERCENT,
    verticalOffsetPx = DEFAULT_VERTICAL_OFFSET_PX,
    canvasWidth = 1200,
    canvasHeight = 1800,
    backgroundColor = "#ffffff",
  } = options

  console.log("\n=== 프린터 보정 적용 ===")
  console.log(`- SHRINK_PERCENT: ${shrinkPercent}%`)
  console.log(`- VERTICAL_OFFSET_PX: ${verticalOffsetPx}px`)
  console.log(`- Canvas Size: ${canvasWidth}×${canvasHeight}`)

  const shrinkScale = shrinkPercent / 100

  // 1) Shrink the image
  const targetW = Math.round(canvasWidth * shrinkScale)
  const targetH = Math.round(canvasHeight * shrinkScale)

  console.log(`- 축소 크기: ${targetW}×${targetH}`)

  const resized = await sharp(imageBuffer)
    .resize(targetW, targetH, { fit: "cover", background: backgroundColor })
    .toBuffer()

  // 2) Place on canvas with center alignment + vertical offset
  const left = Math.round((canvasWidth - targetW) / 2)
  const top = Math.round((canvasHeight - targetH) / 2 + verticalOffsetPx)

  console.log(`- 합성 위치: left=${left}, top=${top}`)

  const finalJpeg = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: backgroundColor,
    },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 100 })
    .toBuffer()

  console.log(
    `- 최종 크기: ${(finalJpeg.length / 1024).toFixed(1)} KB`
  )

  return finalJpeg
}

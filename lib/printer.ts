import path from 'path'
import fs from 'fs/promises'

import sharp from 'sharp'
import { printViaEmail } from './email-printer'
import { emitPrintJob } from './socket-server'
import { applyPrinterCorrection } from './image-correction'
import type { PrintMethod } from './types'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // ⚠️ 내부망 테스트 전용

/**
 * PUBLIC API — printImage()
 *
 * 이벤트별 printMethod에 따라 인쇄 방식을 결정합니다:
 *   'email'  → Epson Email Print (기본값)
 *   'socket' → phototoast 클라이언트 (Socket.IO)
 */
export async function printImage(
  imageUrl: string,
  printMethod: PrintMethod = 'email',
  options?: { size?: string; borderCorrection?: boolean; shrinkPercent?: number; verticalOffsetPx?: number }
): Promise<{ success: boolean; error?: string; printedImageUrl?: string }> {
  try {
    // URL → 파일 경로 변환
    let imagePath: string

    console.log(`\n====================================`)
    console.log(`Print Job Request`)
    console.log(`====================================`)
    console.log(`Image URL: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`)

    // data URL (base64) 처리 — Vercel 환경
    if (imageUrl.startsWith('data:')) {
      console.log(`Image Type: Data URL (base64), converting to temporary file`)

      const base64Data = imageUrl.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')

      const timestamp = Date.now()
      const tempDir = '/tmp/uploads'
      await fs.mkdir(tempDir, { recursive: true })
      imagePath = path.join(tempDir, `print-${timestamp}.jpg`)
      await fs.writeFile(imagePath, buffer)

      console.log(`Temporary file saved: ${imagePath}`)
    } else if (imageUrl.startsWith('/api/serve-image/')) {
      // Vercel: /api/serve-image/filename → /tmp/uploads/filename
      const filename = imageUrl.replace('/api/serve-image/', '')
      imagePath = path.join('/tmp/uploads', filename)
    } else if (imageUrl.startsWith('/uploads/')) {
      // 로컬: /uploads/filename → public/uploads/filename
      imagePath = path.join(process.cwd(), 'public', imageUrl)
    } else if (imageUrl.startsWith('/tmp')) {
      // 절대 경로 (Vercel 레거시)
      imagePath = imageUrl
    } else {
      imagePath = path.join(process.cwd(), 'public', imageUrl)
    }

    console.log(`Image Path: ${imagePath}`)

    // 파일 존재 여부 확인
    await fs.access(imagePath)

    if (printMethod === 'socket') {
      // ── Socket 방식: phototoast 클라이언트로 전송 ──
      console.log(`Print Method: Socket (phototoast 클라이언트)`)

      // output 폴더 준비
      const isVercel = process.env.VERCEL === '1'
      const outputDir = isVercel ? '/tmp/output' : path.join(process.cwd(), 'output')
      await fs.mkdir(outputDir, { recursive: true })
      const timestamp = Date.now()

      let imageBuffer = await fs.readFile(imagePath)

      // 원본 저장
      const originalPath = path.join(outputDir, `socket-original-${timestamp}.jpg`)
      await fs.writeFile(originalPath, imageBuffer)
      console.log(`원본 저장: ${originalPath}`)

      // 가로 이미지 → 세로 회전 (4×6 인쇄용)
      const metadata = await sharp(imageBuffer).metadata()
      const imgW = metadata.width || 1200
      const imgH = metadata.height || 1800
      if (imgW > imgH) {
        console.log(`가로 이미지 감지 (${imgW}×${imgH}) → 90° 회전`)
        imageBuffer = Buffer.from(await sharp(imageBuffer).rotate(90).jpeg({ quality: 100 }).toBuffer())
        const rotatedPath = path.join(outputDir, `socket-rotated-${timestamp}.jpg`)
        await fs.writeFile(rotatedPath, imageBuffer)
        console.log(`회전 저장: ${rotatedPath}`)
      }

      // 테두리 보정 적용 (socket도 기본 ON, 명시적 false일 때만 스킵)
      let finalImagePath = imagePath
      if (options?.borderCorrection !== false) {
        console.log(`테두리 보정 적용 중... (shrink: ${options?.shrinkPercent ?? 'default'}%, offset: ${options?.verticalOffsetPx ?? 'default'}px)`)
        const correctedBuffer = await applyPrinterCorrection(imageBuffer, {
          canvasWidth: 1200,
          canvasHeight: 1800,
          shrinkPercent: options?.shrinkPercent ?? 97.5,
          verticalOffsetPx: options?.verticalOffsetPx ?? 0,
        })
        const correctedPath = path.join(outputDir, `socket-corrected-${timestamp}.jpg`)
        await fs.writeFile(correctedPath, correctedBuffer)
        console.log(`보정 저장: ${correctedPath}`)
        finalImagePath = correctedPath
      }

      // SEND_PRINTER=false이면 소켓 전송 스킵
      const sendPrinterEnabled = process.env.SEND_PRINTER !== 'false'
      if (!sendPrinterEnabled) {
        console.log(`SEND_PRINTER=false → 파일 준비 완료, 소켓 전송 스킵`)
        console.log(`====================================\n`)
        return { success: true }
      }

      const result = await emitPrintJob({
        imagePath: finalImagePath,
        size: options?.size || '4x6',
        filename: path.basename(finalImagePath),
      })

      return {
        success: result.success,
        error: result.error,
        printedImageUrl: undefined, // 클라이언트 측 인쇄이므로 URL 없음
      }
    } else {
      // ── Email 방식: Epson Email Print (기본값) ──
      console.log(`Print Method: Email Print (Epson Email Print)`)

      const result = await printViaEmail(imagePath, {
        borderCorrection: options?.borderCorrection,
        shrinkPercent: options?.shrinkPercent,
        verticalOffsetPx: options?.verticalOffsetPx,
      })

      return {
        success: result.success,
        error: result.error,
        printedImageUrl: result.printedImageBase64,
      }
    }
  } catch (e: any) {
    console.error('Print error:', e)
    return { success: false, error: e.message }
  }
}

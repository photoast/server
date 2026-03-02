import path from 'path'
import fs from 'fs/promises'

import { printViaEmail } from './email-printer'

/**
 * PUBLIC API — printImage()
 *
 * Epson Email Print를 통해 인쇄합니다.
 */
export async function printImage(
  imageUrl: string,
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
  } catch (e: any) {
    console.error('Print error:', e)
    return { success: false, error: e.message }
  }
}

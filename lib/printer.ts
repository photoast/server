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
  options?: { size?: string; borderCorrection?: boolean; shrinkPercent?: number; verticalOffsetPx?: number; printerEmail?: string }
): Promise<{ success: boolean; error?: string; printedImageUrl?: string }> {
  try {
    // URL → 파일 경로 변환
    let imagePath: string

    console.log(`\n====================================`)
    console.log(`Print Job Request`)
    console.log(`====================================`)
    console.log(`Image URL: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`)

    // blob URL 또는 외부 URL → 임시 파일로 다운로드
    if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
      console.log(`Image Type: External URL, downloading to temporary file`)
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`Failed to fetch image: ${imageUrl}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const tempDir = '/tmp/uploads'
      await fs.mkdir(tempDir, { recursive: true })
      imagePath = path.join(tempDir, `print-${Date.now()}.jpg`)
      await fs.writeFile(imagePath, buffer)
    } else if (imageUrl.startsWith('data:')) {
      // data URL (base64) 처리
      console.log(`Image Type: Data URL (base64), converting to temporary file`)
      const base64Data = imageUrl.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      const tempDir = '/tmp/uploads'
      await fs.mkdir(tempDir, { recursive: true })
      imagePath = path.join(tempDir, `print-${Date.now()}.jpg`)
      await fs.writeFile(imagePath, buffer)
    } else if (imageUrl.startsWith('/api/serve-image/')) {
      const filename = imageUrl.replace('/api/serve-image/', '')
      imagePath = path.join('/tmp/uploads', filename)
    } else if (imageUrl.startsWith('/uploads/')) {
      imagePath = path.join(process.cwd(), 'public', imageUrl)
    } else if (imageUrl.startsWith('/tmp')) {
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
      printerEmail: options?.printerEmail,
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

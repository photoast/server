import path from 'path'
import fs from 'fs/promises'

import { printCalibration4x6 } from './pm'
import { printViaEmail } from './email-printer'



process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // ⚠️ 내부망 테스트 전용



/**
 * PUBLIC API — printImage()
 *
 * Supports two print methods:
 * 1. Email Print (Epson Email Print) - Default
 * 2. IPP Print (Direct network printing) - Legacy, currently disabled
 */
export async function printImage(
  imageUrl: string,
  printerUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert URL to file path
    let imagePath: string

    if (imageUrl.startsWith('/api/serve-image/')) {
      // Vercel: /api/serve-image/filename → /tmp/uploads/filename
      const filename = imageUrl.replace('/api/serve-image/', '')
      imagePath = path.join('/tmp/uploads', filename)
    } else if (imageUrl.startsWith('/uploads/')) {
      // Local: /uploads/filename → public/uploads/filename
      imagePath = path.join(process.cwd(), 'public', imageUrl)
    } else if (imageUrl.startsWith('/tmp')) {
      // Legacy absolute path (Vercel)
      imagePath = imageUrl
    } else {
      // Relative path (local)
      imagePath = path.join(process.cwd(), 'public', imageUrl)
    }

    console.log(`\n====================================`)
    console.log(`Print Job Request`)
    console.log(`====================================`)
    console.log(`Image URL: ${imageUrl}`)
    console.log(`Image Path: ${imagePath}`)
    console.log(`Target Size: 4×6 inch (glossy, borderless)`)

    // Verify file exists
    await fs.access(imagePath)

    // Use Email Print method (Epson Email Print)
    console.log(`Print Method: Email Print (Epson Email Print)`)
    const result = await printViaEmail(imagePath)

    // Legacy IPP method (currently disabled)
    // const result = await printCalibration4x6(printerUrl, imagePath)

    return result
  } catch (e: any) {
    console.error('Print error:', e)
    return { success: false, error: e.message }
  }
}



import nodemailer from 'nodemailer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { applyPrinterCorrection } from './image-correction'

// Epson Email Print address
const EPSON_PRINT_EMAIL = 'eyx3988j7dyi07@print.epsonconnect.com'

/**
 * Send image to Epson Email Print service
 * @param imagePath - Local file path to the image
 * @returns Success status, error message if any, and the printed image as base64
 */
export async function printViaEmail(
  imagePath: string
): Promise<{ success: boolean; error?: string; printedImageBase64?: string }> {
  try {
    // Validate image file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`)
    }

    // Get SMTP configuration from environment variables
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env file')
    }

    console.log('\n====================================')
    console.log('Email Print Job Request')
    console.log('====================================')
    console.log(`Image: ${imagePath}`)
    console.log(`Printer Email: ${EPSON_PRINT_EMAIL}`)
    console.log(`SMTP Server: ${smtpHost}:${smtpPort}`)
    console.log(`From: ${smtpFrom}`)

    // Step 1: Read the original image and detect dimensions
    console.log(`\nStep 1: Reading original image and detecting dimensions`)
    let imageBuffer = fs.readFileSync(imagePath)

    // Detect image dimensions to handle both portrait (1200×1800) and landscape (1800×1200)
    const metadata = await sharp(imageBuffer).metadata()
    const imageWidth = metadata.width || 1200
    const imageHeight = metadata.height || 1800
    const isLandscape = imageWidth > imageHeight

    console.log(`Image dimensions: ${imageWidth}×${imageHeight} (${isLandscape ? 'landscape 6×4' : 'portrait 4×6'})`)

    // Save original for debugging
    const isVercel = process.env.VERCEL === '1'
    const outputDir = isVercel ? '/tmp/output' : path.join(process.cwd(), 'output')

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = Date.now()
    const originalPath = path.join(outputDir, `email-original-${timestamp}.jpg`)
    fs.writeFileSync(originalPath, imageBuffer)
    console.log(`원본 이미지 저장: ${originalPath}`)

    // Step 1.5: Rotate landscape images to portrait for printing
    // Printer only supports 4×6 paper, so 6×4 images must be rotated 90° clockwise
    if (isLandscape) {
      console.log('\nStep 1.5: Rotating landscape image 90° clockwise for 4×6 printing')
      const rotatedBuffer = await sharp(imageBuffer)
        .rotate(90)
        .jpeg({ quality: 100 })
        .toBuffer()
      imageBuffer = Buffer.from(rotatedBuffer)

      const rotatedPath = path.join(outputDir, `email-rotated-${timestamp}.jpg`)
      fs.writeFileSync(rotatedPath, imageBuffer)
      console.log(`회전된 이미지 저장: ${rotatedPath} (1800×1200 → 1200×1800)`)
    }

    // Step 2: Apply printer correction (shrink + vertical offset)
    // This compensates for physical printer characteristics
    // After rotation, all images are 1200×1800 (portrait)
    console.log('\nStep 2: Applying printer correction (for physical print only)')
    const correctedBuffer = await applyPrinterCorrection(imageBuffer, {
      canvasWidth: 1200,
      canvasHeight: 1800,
    })

    // Save corrected version for debugging
    const correctedPath = path.join(outputDir, `email-corrected-${timestamp}.jpg`)
    fs.writeFileSync(correctedPath, correctedBuffer)
    console.log(`보정 이미지 저장: ${correctedPath}`)
    console.log(`주의: 다운로드는 원본, 프린트는 보정된 이미지 사용`)

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    // Verify SMTP connection
    await transporter.verify()
    console.log('SMTP connection verified')

    // Send email with corrected image attachment
    // Note: Download uses original, print uses corrected version
    const filename = `corrected-${path.basename(imagePath)}`
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: EPSON_PRINT_EMAIL,
      subject: 'Print Photo',
      text: 'Please print the attached photo.',
      attachments: [
        {
          filename: filename,
          content: correctedBuffer,
        },
      ],
    })

    console.log('Email sent successfully')
    console.log(`Message ID: ${info.messageId}`)
    console.log('====================================\n')

    // Return the corrected image as base64 for print history
    const printedImageBase64 = `data:image/jpeg;base64,${correctedBuffer.toString('base64')}`

    return { success: true, printedImageBase64 }
  } catch (error: any) {
    console.error('Email print error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email to printer',
    }
  }
}

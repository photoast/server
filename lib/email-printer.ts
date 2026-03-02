import nodemailer from 'nodemailer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { applyPrinterCorrection } from './image-correction'

// Epson Email Print address
const EPSON_PRINT_EMAIL = 'msx7208cwudwu4@print.epsonconnect.com'

/**
 * Send image to Epson Email Print service
 * @param imagePath - Local file path to the image
 * @returns Success status, error message if any, and the printed image as base64
 */
export async function printViaEmail(
  imagePath: string,
  options?: { borderCorrection?: boolean; shrinkPercent?: number; verticalOffsetPx?: number }
): Promise<{ success: boolean; error?: string; printedImageBase64?: string }> {
  try {
    // Check if SEND_PRINTER is disabled (for local testing)
    const sendMailEnabled = process.env.SEND_PRINTER !== 'false'

    // Validate image file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`)
    }

    console.log('\n====================================')
    console.log(sendMailEnabled ? 'Email Print Job Request' : 'Email Print SKIPPED (SEND_PRINTER=false)')
    console.log('====================================')
    console.log(`Image: ${imagePath}`)
    if (sendMailEnabled) {
      console.log(`Printer Email: ${EPSON_PRINT_EMAIL}`)
    }

    // Get SMTP configuration from environment variables (only if sending email)
    let smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom
    if (sendMailEnabled) {
      smtpHost = process.env.SMTP_HOST
      smtpPort = parseInt(process.env.SMTP_PORT || '587')
      smtpUser = process.env.SMTP_USER
      smtpPass = process.env.SMTP_PASS
      smtpFrom = process.env.SMTP_FROM || smtpUser

      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env file')
      }

      console.log(`SMTP Server: ${smtpHost}:${smtpPort}`)
      console.log(`From: ${smtpFrom}`)
    } else {
      console.log('로컬 테스트 모드: 이미지 처리만 수행하고 SMTP는 건너뜁니다')
    }

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

    // Step 2: Apply printer correction (shrink + vertical offset) — optional
    const applyCorrection = options?.borderCorrection !== false
    let finalBuffer: Buffer

    if (applyCorrection) {
      console.log(`\nStep 2: Applying printer border correction (shrink: ${options?.shrinkPercent ?? 'default'}%, offset: ${options?.verticalOffsetPx ?? 'default'}px)`)
      const correctedBuffer = await applyPrinterCorrection(imageBuffer, {
        canvasWidth: 1200,
        canvasHeight: 1800,
        shrinkPercent: options?.shrinkPercent ?? 95.25,
        verticalOffsetPx: options?.verticalOffsetPx ?? -5,
      })
      const correctedPath = path.join(outputDir, `email-corrected-${timestamp}.jpg`)
      fs.writeFileSync(correctedPath, correctedBuffer)
      console.log(`보정 이미지 저장: ${correctedPath}`)
      finalBuffer = correctedBuffer
    } else {
      console.log('\nStep 2: Border correction SKIPPED (disabled for this event)')
      finalBuffer = imageBuffer
    }

    // Return the final image as base64 for print history
    const printedImageBase64 = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`

    // Skip email sending if SEND_MAIL is disabled
    if (!sendMailEnabled) {
      console.log('\n이미지 처리 완료 (output 저장됨)')
      console.log('SEND_PRINTER=false이므로 실제 프린트는 건너뜁니다')
      console.log('====================================\n')
      return { success: true, printedImageBase64 }
    }

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
          content: finalBuffer,
        },
      ],
    })

    console.log('Email sent successfully')
    console.log(`Message ID: ${info.messageId}`)
    console.log('====================================\n')

    return { success: true, printedImageBase64 }
  } catch (error: any) {
    console.error('Email print error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email to printer',
    }
  }
}

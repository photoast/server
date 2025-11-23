import nodemailer from 'nodemailer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { applyPrinterCorrection } from './image-correction'

// Epson Email Print address
const EPSON_PRINT_EMAIL = 'eyx3988j7dyi07@print.epsonconnect.com'

// Target canvas size for printer correction (same as pm.ts)
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 1800

/**
 * Send image to Epson Email Print service
 * @param imagePath - Local file path to the image
 * @returns Success status and error message if any
 */
export async function printViaEmail(
  imagePath: string
): Promise<{ success: boolean; error?: string }> {
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

    // Step 1: Resize image to printer canvas size (1200×1800)
    console.log(`\nStep 1: Resizing to ${CANVAS_WIDTH}×${CANVAS_HEIGHT}`)
    const resizedBuffer = await sharp(imagePath)
      .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 95 })
      .toBuffer()

    // Save original (resized) version
    const outputDir = path.join(process.cwd(), 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = Date.now()
    const originalPath = path.join(outputDir, `email-original-${timestamp}.jpg`)
    fs.writeFileSync(originalPath, resizedBuffer)
    console.log(`원본(리사이즈) 저장: ${originalPath}`)

    // Step 2: Apply printer correction (shrink + vertical offset)
    console.log('\nStep 2: Applying printer correction')
    const correctedBuffer = await applyPrinterCorrection(resizedBuffer, {
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    })

    // Save corrected version
    const correctedPath = path.join(outputDir, `email-corrected-${timestamp}.jpg`)
    fs.writeFileSync(correctedPath, correctedBuffer)
    console.log(`보정 버전 저장: ${correctedPath}`)

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

    return { success: true }
  } catch (error: any) {
    console.error('Email print error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email to printer',
    }
  }
}

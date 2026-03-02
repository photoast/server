import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { findEventBySlug, findPrinterById, createPrintJob } from '@/lib/models'
import { printImage } from '@/lib/printer'
import { applyPrinterCorrection } from '@/lib/image-correction'
import { DeviceInfo } from '@/lib/types'

function resolveImagePath(imageUrl: string): string {
  if (imageUrl.startsWith('/api/serve-image/')) {
    const filename = imageUrl.replace('/api/serve-image/', '')
    return path.join('/tmp/uploads', filename)
  }
  if (imageUrl.startsWith('/uploads/')) {
    return path.join(process.cwd(), 'public', imageUrl)
  }
  if (imageUrl.startsWith('/tmp')) {
    return imageUrl
  }
  return path.join(process.cwd(), 'public', imageUrl)
}

// Extract IP address from request
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  return 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, imageUrl, deviceInfo: clientDeviceInfo, quantity = 1 } = body

    if (!slug || !imageUrl) {
      return NextResponse.json(
        { error: 'Event slug and image URL are required' },
        { status: 400 }
      )
    }

    // Validate quantity
    const printQuantity = Math.max(1, Math.min(10, parseInt(quantity) || 1))

    // Get event
    const event = await findEventBySlug(slug)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Resolve printer from event
    const printer = event.printerId ? await findPrinterById(event.printerId) : null
    if (!printer) {
      return NextResponse.json(
        { error: '이벤트에 프린터가 설정되지 않았습니다' },
        { status: 400 }
      )
    }

    console.log(`[Print API] Processing ${printQuantity} copy(ies) via printer "${printer.name}"`)

    // Collect device information
    const deviceInfo: DeviceInfo | undefined = clientDeviceInfo
      ? {
          ...clientDeviceInfo,
          ipAddress: getClientIp(request),
        }
      : undefined

    const jobIds: string[] = []
    const errors: string[] = []

    // Print multiple copies
    for (let i = 0; i < printQuantity; i++) {
      console.log(`[Print API] Sending print job ${i + 1}/${printQuantity}`)

      try {
        if (printer.printMethod === 'polling') {
          // Polling: apply image correction, save corrected image, create PENDING job
          let imagePath: string
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1]
            const buffer = Buffer.from(base64Data, 'base64')
            const tempDir = '/tmp/uploads'
            await fs.mkdir(tempDir, { recursive: true })
            imagePath = path.join(tempDir, `print-${Date.now()}.jpg`)
            await fs.writeFile(imagePath, buffer)
          } else {
            imagePath = resolveImagePath(imageUrl)
          }

          let imageBuffer = await fs.readFile(imagePath)

          // Rotate landscape images for 4x6 printing
          const metadata = await sharp(imageBuffer).metadata()
          if ((metadata.width || 0) > (metadata.height || 0)) {
            imageBuffer = Buffer.from(await sharp(imageBuffer).rotate(90).jpeg({ quality: 100 }).toBuffer())
          }

          // Apply printer correction
          if (printer.borderCorrectionEnabled) {
            imageBuffer = Buffer.from(await applyPrinterCorrection(imageBuffer, {
              canvasWidth: 1200,
              canvasHeight: 1800,
              shrinkPercent: printer.shrinkPercent,
              verticalOffsetPx: printer.verticalOffsetPx,
            }))
          }

          // Save corrected image
          const correctedFilename = `corrected-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const uploadDir = '/tmp/uploads'
          await fs.mkdir(uploadDir, { recursive: true })
          await fs.writeFile(path.join(uploadDir, correctedFilename), imageBuffer)
          const correctedUrl = `/api/serve-image/${correctedFilename}`

          const printJob = await createPrintJob({
            eventId: event._id!.toString(),
            printerId: printer._id!.toString(),
            imageUrl,
            printedImageUrl: correctedUrl,
            status: 'PENDING',
            deviceInfo,
          })
          jobIds.push(printJob._id?.toString() || '')
          console.log(`[Print API] Print job ${i + 1}/${printQuantity} created as PENDING (polling)`)
        } else {
          // Email: send via Epson Email Print
          const result = await printImage(imageUrl, {
            borderCorrection: printer.borderCorrectionEnabled,
            shrinkPercent: printer.shrinkPercent,
            verticalOffsetPx: printer.verticalOffsetPx,
            printerEmail: printer.email,
          })

          const printJob = await createPrintJob({
            eventId: event._id!.toString(),
            imageUrl,
            printedImageUrl: result.printedImageUrl,
            status: result.success ? 'DONE' : 'FAILED',
            deviceInfo,
            errorMessage: result.error,
          })

          if (result.success) {
            jobIds.push(printJob._id?.toString() || '')
            console.log(`[Print API] Print job ${i + 1}/${printQuantity} succeeded`)
          } else {
            errors.push(`Copy ${i + 1}: ${result.error || 'Print job failed'}`)
            console.error(`[Print API] Print job ${i + 1}/${printQuantity} failed:`, result.error)
          }
        }
      } catch (err: any) {
        errors.push(`Copy ${i + 1}: ${err.message || 'Unknown error'}`)
        console.error(`[Print API] Print job ${i + 1}/${printQuantity} error:`, err)
      }
    }

    // Return result
    if (errors.length === 0) {
      return NextResponse.json({
        success: true,
        jobIds,
        quantity: printQuantity,
        message: `${printQuantity}매 인쇄 완료`,
      })
    } else if (jobIds.length > 0) {
      // Partial success
      return NextResponse.json({
        success: true,
        jobIds,
        quantity: jobIds.length,
        message: `${jobIds.length}/${printQuantity}매 인쇄 완료 (일부 실패)`,
        warnings: errors,
      })
    } else {
      // Complete failure
      return NextResponse.json(
        {
          success: false,
          error: errors.join('; '),
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error processing print request:', error)
    return NextResponse.json(
      { error: 'Failed to process print request' },
      { status: 500 }
    )
  }
}

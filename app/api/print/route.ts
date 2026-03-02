import { NextRequest, NextResponse } from 'next/server'
import { findEventBySlug, createPrintJob } from '@/lib/models'
import { printImage } from '@/lib/printer'
import { DeviceInfo } from '@/lib/types'

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

    console.log(`[Print API] Processing ${printQuantity} copy(ies) of image`)

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
        // Send print job
        const result = await printImage(imageUrl, event.printMethod || 'email', {
          borderCorrection: event.borderCorrectionEnabled,
        })

        // Record print job
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

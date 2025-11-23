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
    const { slug, imageUrl, deviceInfo: clientDeviceInfo } = body

    if (!slug || !imageUrl) {
      return NextResponse.json(
        { error: 'Event slug and image URL are required' },
        { status: 400 }
      )
    }

    // Get event
    const event = await findEventBySlug(slug)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Send print job
    const result = await printImage(imageUrl, event.printerUrl)

    // Collect device information
    const deviceInfo: DeviceInfo | undefined = clientDeviceInfo
      ? {
          ...clientDeviceInfo,
          ipAddress: getClientIp(request),
        }
      : undefined

    // Record print job
    const printJob = await createPrintJob({
      eventId: event._id!.toString(),
      imageUrl,
      status: result.success ? 'DONE' : 'FAILED',
      deviceInfo,
      errorMessage: result.error,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Print job failed',
          jobId: printJob._id?.toString(),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId: printJob._id?.toString(),
    })
  } catch (error) {
    console.error('Error processing print request:', error)
    return NextResponse.json(
      { error: 'Failed to process print request' },
      { status: 500 }
    )
  }
}

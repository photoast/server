import { NextRequest, NextResponse } from 'next/server'
import { processImage } from '@/lib/image'
import path from 'path'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logoUrl, photoAreaRatio, logoSettings } = body

    // Read sample image
    const sampleImagePath = path.join(process.cwd(), 'public', 'sample-photo.jpg')
    const sampleBuffer = await fs.readFile(sampleImagePath)

    // Process image with logo settings (white background for single photo with logo)
    const processedBuffer = await processImage(
      sampleBuffer,
      logoUrl,
      undefined, // no crop
      photoAreaRatio ?? 85,
      logoSettings,
      'single-with-logo', // frame type - use single-with-logo to show logo
      '#FFFFFF' // white background
    )

    // Return image as response
    return new NextResponse(new Uint8Array(processedBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating preview:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Check both /tmp (Vercel) and public/uploads (local)
    const isVercel = process.env.VERCEL === '1'

    const filePath = isVercel
      ? path.join('/tmp/uploads', filename)
      : path.join(process.cwd(), 'public', 'uploads', filename)

    // Read file
    const fileBuffer = await fs.readFile(filePath)

    // Return image
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('Error serving image:', error)

    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}

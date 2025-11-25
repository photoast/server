import { NextRequest, NextResponse } from 'next/server'
import { saveUploadedFile } from '@/lib/image'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'logo' or 'photo'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `${type || 'image'}-${timestamp}.${extension}`

    // Save file
    const filepath = await saveUploadedFile(file, filename)

    // In Vercel, also return base64 for logos
    const isVercel = process.env.VERCEL === '1'
    if (isVercel && type === 'logo') {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')
      const mimeType = file.type
      const dataUrl = `data:${mimeType};base64,${base64}`

      return NextResponse.json({ url: filepath, base64: dataUrl })
    }

    return NextResponse.json({ url: filepath })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

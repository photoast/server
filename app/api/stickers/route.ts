import { NextRequest, NextResponse } from 'next/server'
import { getAllStickers, createSticker } from '@/lib/models'
import { saveUploadedFile } from '@/lib/image'
import { checkAuth } from '@/lib/middleware'

export async function GET() {
  try {
    const stickers = await getAllStickers()
    return NextResponse.json(stickers)
  } catch (error) {
    console.error('Error fetching stickers:', error)
    return NextResponse.json({ error: 'Failed to fetch stickers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `sticker-${timestamp}.${extension}`

    const url = await saveUploadedFile(file, filename)

    const sticker = await createSticker({ url, filename })

    return NextResponse.json(sticker)
  } catch (error) {
    console.error('Error uploading sticker:', error)
    return NextResponse.json({ error: 'Failed to upload sticker' }, { status: 500 })
  }
}

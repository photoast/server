import { NextRequest, NextResponse } from 'next/server'
import memoryDB from '@/lib/memorydb'
import { saveUploadedFile } from '@/lib/image'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const layout = await memoryDB.getLayoutById(params.id)
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.includes('png')) {
      return NextResponse.json({ error: 'Frame must be a PNG file' }, { status: 400 })
    }

    const filename = `frame-${params.id}-${Date.now()}.png`
    const frameUrl = await saveUploadedFile(file, filename)

    await memoryDB.updateLayout(params.id, { frameUrl })

    return NextResponse.json({ frameUrl })
  } catch (err) {
    console.error('Frame upload error:', err)
    return NextResponse.json({ error: 'Failed to upload frame' }, { status: 500 })
  }
}

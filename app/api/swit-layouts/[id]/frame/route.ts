import { NextRequest, NextResponse } from 'next/server'
import { getLayoutById, updateLayout } from '@/lib/models'
import { saveUploadedFile } from '@/lib/image'
import type { SwitFrameLayer } from '@/lib/types'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const layout = await getLayoutById(params.id)
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Accept PNG, JPG, WebP, SVG
    const type = file.type.toLowerCase()
    if (!type.includes('png') && !type.includes('jpeg') && !type.includes('jpg') && !type.includes('webp') && !type.includes('svg')) {
      return NextResponse.json({ error: 'PNG, JPG, WebP, SVG 형식만 지원합니다' }, { status: 400 })
    }

    const ext = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const filename = `frame-${params.id}-${Date.now()}.${ext}`
    const imageUrl = await saveUploadedFile(file, filename)

    const layerName = (formData.get('name') as string) || '프레임'

    // Compute default zIndex: max existing + 10
    const allZIndices = [
      ...layout.slots.map(s => s.zIndex ?? 10),
      ...(layout.frameLayers || []).map(l => l.zIndex),
    ]
    const maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0

    const newLayer: SwitFrameLayer = {
      id: `layer-${Date.now()}`,
      name: layerName,
      imageUrl,
      zIndex: maxZ + 10,
      opacity: 1,
      visible: true,
    }

    const frameLayers = [...(layout.frameLayers || []), newLayer]
    await updateLayout(params.id, { frameLayers })

    return NextResponse.json({ layer: newLayer, frameLayers })
  } catch (err) {
    console.error('Frame upload error:', err)
    return NextResponse.json({ error: 'Failed to upload frame' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { layerId } = await request.json()
    const layout = await getLayoutById(params.id)
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

    const frameLayers = (layout.frameLayers || []).filter(l => l.id !== layerId)
    await updateLayout(params.id, { frameLayers })

    return NextResponse.json({ frameLayers })
  } catch (err) {
    console.error('Frame delete error:', err)
    return NextResponse.json({ error: 'Failed to delete frame layer' }, { status: 500 })
  }
}

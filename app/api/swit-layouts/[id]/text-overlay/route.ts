import { NextRequest, NextResponse } from 'next/server'
import { getLayoutById, updateLayout } from '@/lib/models'
import { generateTextOverlay } from '@/lib/textOverlay'
import { uploadToBlob } from '@/lib/blob'
import type { SwitFrameLayer } from '@/lib/types'

/**
 * 텍스트 오버레이 생성 API
 *
 * POST /api/swit-layouts/{id}/text-overlay
 * Body: { text, fontSize?, color?, bgStyle?, bgColor?, align?, bold? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const layout = await getLayoutById(params.id)
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

    const body = await request.json()
    const { text } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text는 필수입니다' }, { status: 400 })
    }

    const buffer = await generateTextOverlay({
      text: text.trim(),
      fontSize: body.fontSize || undefined,
      color: body.color || undefined,
      bgStyle: body.bgStyle || undefined,
      bgColor: body.bgColor || undefined,
      align: body.align || undefined,
      bold: body.bold !== undefined ? body.bold : undefined,
    })

    const filename = `text-overlay-${params.id}-${Date.now()}.png`
    const imageUrl = await uploadToBlob(filename, buffer)

    // 텍스트 크기 메타데이터
    const sharp = (await import('sharp')).default
    const meta = await sharp(buffer).metadata()

    const allZ = [
      ...layout.slots.map(s => s.zIndex ?? 10),
      ...(layout.frameLayers || []).map(l => l.zIndex),
    ]
    const maxZ = allZ.length > 0 ? Math.max(...allZ) : 0

    // 캔버스 중앙에 배치
    const layerW = meta.width || 400
    const layerH = meta.height || 100
    const newLayer: SwitFrameLayer = {
      id: `layer-txt-${Date.now()}`,
      name: `텍스트: ${text.slice(0, 15)}${text.length > 15 ? '…' : ''}`,
      imageUrl,
      zIndex: maxZ + 10,
      opacity: 1,
      visible: true,
      x: Math.round((layout.canvasWidth - layerW) / 2),
      y: Math.round((layout.canvasHeight - layerH) / 2),
      width: layerW,
      height: layerH,
    }

    const frameLayers = [...(layout.frameLayers || []), newLayer]
    await updateLayout(params.id, { frameLayers })

    return NextResponse.json({ layer: newLayer, frameLayers })
  } catch (err: any) {
    console.error('Text overlay error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

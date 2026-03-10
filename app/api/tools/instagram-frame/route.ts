import { NextRequest, NextResponse } from 'next/server'
import { generateInstagramFrame } from '@/lib/instagramFrame'

/**
 * 인스타그램 프레임 독립 생성 API (도구 모음용)
 *
 * POST /api/tools/instagram-frame
 * Body: { username, qrUrl?, caption?, likesText?, qrLabel? }
 *
 * 레이아웃에 연결하지 않고 프레임 PNG를 생성하여 반환합니다.
 * - action: "preview" → base64 데이터 URL 반환
 * - action: "download" → PNG 바이너리 반환
 * - action: "apply" → 특정 레이아웃에 적용 (layoutId 필요)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, qrUrl, caption, likesText, qrLabel, action = 'preview', layoutId } = body

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username은 필수입니다' }, { status: 400 })
    }

    const frameBuffer = await generateInstagramFrame({
      username: username.trim(),
      qrUrl: qrUrl || undefined,
      caption: caption || undefined,
      likesText: likesText || undefined,
      qrLabel: qrLabel || undefined,
    })

    if (action === 'download') {
      return new NextResponse(new Uint8Array(frameBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="instagram-frame-${username.replace(/^@/, '')}.png"`,
        },
      })
    }

    if (action === 'apply' && layoutId) {
      const { getLayoutById, updateLayout } = await import('@/lib/models')
      const { uploadToBlob } = await import('@/lib/blob')

      const layout = await getLayoutById(layoutId)
      if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

      const filename = `instagram-frame-${layoutId}-${Date.now()}.png`
      const imageUrl = await uploadToBlob(filename, frameBuffer)

      const existingLayers = (layout.frameLayers || []).filter(l => !l.name.startsWith('Instagram'))
      const allZ = [...layout.slots.map(s => s.zIndex ?? 10), ...existingLayers.map(l => l.zIndex)]
      const maxZ = allZ.length > 0 ? Math.max(...allZ) : 0

      const newLayer = {
        id: `layer-ig-${Date.now()}`,
        name: `Instagram @${username.replace(/^@/, '')}`,
        imageUrl,
        zIndex: maxZ + 10,
        opacity: 1,
        visible: true,
      }

      const frameLayers = [...existingLayers, newLayer]
      await updateLayout(layoutId, { frameLayers })

      return NextResponse.json({ layer: newLayer, frameLayers, applied: true })
    }

    // preview: base64
    const base64 = frameBuffer.toString('base64')
    return NextResponse.json({ dataUrl: `data:image/png;base64,${base64}` })
  } catch (err: any) {
    console.error('Instagram frame tool error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

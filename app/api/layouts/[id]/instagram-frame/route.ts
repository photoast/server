import { NextRequest, NextResponse } from 'next/server'
import { getLayoutById, updateLayout } from '@/lib/models'
import { generateInstagramFrame } from '@/lib/instagramFrame'
import { uploadToBlob } from '@/lib/blob'
import type { FrameLayer } from '@/lib/types'

/**
 * 인스타그램 프레임 생성 API
 *
 * POST /api/layouts/{id}/instagram-frame
 * Body: { username: string, qrUrl?: string }
 *
 * 인스타그램 스타일 프레임 PNG를 생성하고 레이아웃의 프레임 레이어로 추가합니다.
 * 기존 인스타그램 프레임 레이어가 있으면 교체합니다.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const layout = await getLayoutById(params.id)
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })

    const { username, qrUrl, caption, likesText, qrLabel } = await request.json()
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username은 필수입니다' }, { status: 400 })
    }

    // 프레임 PNG 생성
    const frameBuffer = await generateInstagramFrame({
      username: username.trim(),
      qrUrl: qrUrl || undefined,
      caption: caption || undefined,
      likesText: likesText || undefined,
      qrLabel: qrLabel || undefined,
    })

    // 파일 저장
    const filename = `instagram-frame-${params.id}-${Date.now()}.png`
    const imageUrl = await uploadToBlob(filename, frameBuffer)

    // 기존 인스타그램 프레임 레이어 제거 (이름으로 식별)
    const existingLayers = (layout.frameLayers || []).filter(
      l => !l.name.startsWith('Instagram')
    )

    // zIndex 계산
    const allZIndices = [
      ...layout.slots.map(s => s.zIndex ?? 10),
      ...existingLayers.map(l => l.zIndex),
    ]
    const maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0

    const newLayer: FrameLayer = {
      id: `layer-ig-${Date.now()}`,
      name: `Instagram @${username.replace(/^@/, '')}`,
      imageUrl,
      zIndex: maxZ + 10,
      opacity: 1,
      visible: true,
    }

    const frameLayers = [...existingLayers, newLayer]
    await updateLayout(params.id, { frameLayers })

    return NextResponse.json({ layer: newLayer, frameLayers })
  } catch (err: any) {
    console.error('Instagram frame generation error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate frame' }, { status: 500 })
  }
}

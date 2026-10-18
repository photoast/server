import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/middleware'
import { createLayout, findEventById } from '@/lib/models'
import { WEDDING_SLOTS } from '@/lib/weddingFrames'
import { normalizeWeddingOverlay } from '@/lib/weddingRegistration'

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '관리자 로그인 후 등록해 주세요.' }, { status: 401 })
  if (Number(request.headers.get('content-length')) > 1600000) return NextResponse.json({ error: '프레임 파일이 너무 큽니다.' }, { status: 413 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: '등록 내용을 확인해 주세요.' }, { status: 400 }) }
  if (!/^[a-f0-9]{24}$/i.test(body.eventId) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) return NextResponse.json({ error: '이벤트와 레이아웃 이름을 확인해 주세요.' }, { status: 400 })
  let overlay: string
  try { overlay = await normalizeWeddingOverlay(body.overlay) } catch { return NextResponse.json({ error: '600×1800 PNG 프레임인지 확인해 주세요.' }, { status: 400 }) }
  try {
    const event = await findEventById(body.eventId)
    if (!event) return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 })
    const layout = await createLayout({ eventId: body.eventId, name: body.name.trim(), printSize: '2x6', canvasWidth: 600, canvasHeight: 1800,
      slots: WEDDING_SLOTS.map(s => ({ ...s })), frameLayers: [{ id: 'wedding-overlay', name: '웨딩 프레임', imageUrl: overlay, zIndex: 100, opacity: 1, visible: true }],
      frameUrl: null, backgroundColor: '#FFFFFF', backgroundColorCustomizable: false })
    return NextResponse.json({ id: layout._id, name: layout.name }, { status: 201 })
  } catch { return NextResponse.json({ error: '등록하지 못했어요. 이벤트 목록을 확인한 뒤 다시 시도해 주세요.' }, { status: 500 }) }
}

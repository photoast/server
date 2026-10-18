import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import sharp from 'sharp'
import { checkAuth } from '@/lib/middleware'
import { getDb } from '@/lib/mongodb'
import { MAX_PROPOSAL_DESIGNS, WEDDING_STYLES, type WeddingOptions } from '@/lib/weddingFrames'
import { normalizeWeddingOverlay } from '@/lib/weddingRegistration'
import { FrameProposal, ProposalItem, PROPOSAL_COLLECTION } from '@/lib/frameProposals'

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '관리자 로그인 후 제안 링크를 만들어 주세요.' }, { status: 401 })
  if (Number(request.headers.get('content-length')) > 3500000) return NextResponse.json({ error: '제안 파일이 너무 큽니다.' }, { status: 413 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: '제안 내용을 확인해 주세요.' }, { status: 400 }) }
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 100 || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_PROPOSAL_DESIGNS) return NextResponse.json({ error: `제목과 1~${MAX_PROPOSAL_DESIGNS}개의 디자인을 선택해 주세요.` }, { status: 400 })
  const items: ProposalItem[] = []
  try {
    for (const item of body.items) {
      const style = WEDDING_STYLES.find(s => s.id === item.id)
      if (!style || items.some(s => s.id === item.id) || !item.options || typeof item.options.names !== 'string' || !item.options.names.trim() || item.options.names.length > 28 || typeof item.options.title !== 'string' || item.options.title.length > 45 || typeof item.options.date !== 'string' || !/^(|\d{4}-\d{2}-\d{2})$/.test(item.options.date) || !/^#[a-f0-9]{6}$/i.test(item.options.accent) || !['serif','sans'].includes(item.options.nameFont) || (item.options.palette !== undefined && !['concept','custom'].includes(item.options.palette))) throw new Error()
      if (typeof item.preview !== 'string' || item.preview.length > 160000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(item.preview)) throw new Error()
      const preview = await sharp(Buffer.from(item.preview.split(',')[1], 'base64'), { limitInputPixels: 1080000 }).resize(240, 720, { fit: 'fill' }).jpeg({ quality: 82 }).toBuffer()
      const o = item.options
      const options: WeddingOptions = { style: style.id, names: o.names, date: o.date, title: o.title, accent: o.accent, nameFont: o.nameFont, ...(o.palette ? { palette: o.palette } : {}) }
      items.push({ id: style.id, name: style.name, options, overlay: await normalizeWeddingOverlay(item.overlay), preview: `data:image/jpeg;base64,${preview.toString('base64')}` })
    }
  } catch { return NextResponse.json({ error: '디자인 이미지와 입력 내용을 확인해 주세요.' }, { status: 400 }) }
  try {
    const proposal: FrameProposal = { _id: randomBytes(18).toString('hex'), title: body.title.trim(), items, createdAt: new Date().toISOString() }
    const db = await getDb()
    await db.collection<FrameProposal>(PROPOSAL_COLLECTION).insertOne(proposal)
    return NextResponse.json({ id: proposal._id }, { status: 201 })
  } catch { return NextResponse.json({ error: '제안 링크를 저장하지 못했어요. 다시 시도해 주세요.' }, { status: 500 }) }
}

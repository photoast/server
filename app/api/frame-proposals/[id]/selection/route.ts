import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { FrameProposal, PROPOSAL_COLLECTION, validProposalId, PRIVATE_LINK_HEADERS } from '@/lib/frameProposals'
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!validProposalId(params.id)) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: '디자인을 선택해 주세요.' }, { status: 400 }) }
  if (typeof body.itemId !== 'string' || body.itemId.length > 40) return NextResponse.json({ error: '디자인을 선택해 주세요.' }, { status: 400 })
  try {
    const db = await getDb()
    const selection = { itemId: body.itemId, selectedAt: new Date().toISOString() }
    const result = await db.collection<FrameProposal>(PROPOSAL_COLLECTION).updateOne({ _id: params.id, 'items.id': body.itemId }, { $set: { selection } })
    if (!result.matchedCount) return NextResponse.json({ error: '제안에 포함된 디자인인지 확인해 주세요.' }, { status: 404 })
    return NextResponse.json({ selection }, { headers: PRIVATE_LINK_HEADERS })
  } catch { return NextResponse.json({ error: '선택을 저장하지 못했어요. 다시 눌러 주세요.' }, { status: 500 }) }
}

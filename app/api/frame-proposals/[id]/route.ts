import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { FrameProposal, PROPOSAL_COLLECTION, validProposalId, PRIVATE_LINK_HEADERS } from '@/lib/frameProposals'
export const dynamic = 'force-dynamic'
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!validProposalId(params.id)) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })
  try {
    const db = await getDb()
    const proposal = await db.collection<FrameProposal>(PROPOSAL_COLLECTION).findOne({ _id: params.id })
    if (!proposal) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })
    return NextResponse.json(proposal, { headers: PRIVATE_LINK_HEADERS })
  } catch { return NextResponse.json({ error: '제안을 불러오지 못했어요.' }, { status: 500 }) }
}

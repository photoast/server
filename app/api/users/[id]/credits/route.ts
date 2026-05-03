import { NextRequest, NextResponse } from 'next/server'
import { chargeCredits, getCreditTransactionsByUserId, findUserById } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const transactions = await getCreditTransactionsByUserId(params.id)
  return NextResponse.json(transactions)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amount, description } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: '충전 금액을 입력해주세요' }, { status: 400 })
  }

  const ok = await chargeCredits(params.id, amount, description || '관리자 충전', 'admin')
  if (!ok) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  }

  const user = await findUserById(params.id)
  return NextResponse.json({ success: true, credits: user?.credits ?? 0 })
}

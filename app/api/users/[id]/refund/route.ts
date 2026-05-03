import { NextRequest, NextResponse } from 'next/server'
import { refundCredits, findPrintJobById, findUserById } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { printJobId, amount, description } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: '환불 금액을 입력해주세요' }, { status: 400 })
  }

  if (printJobId) {
    const job = await findPrintJobById(printJobId)
    if (!job) {
      return NextResponse.json({ error: '프린트 작업을 찾을 수 없습니다' }, { status: 404 })
    }
    if (job.refunded) {
      return NextResponse.json({ error: '이미 환불된 작업입니다' }, { status: 400 })
    }

    const db = await getDb()
    await db.collection(COLLECTIONS.printJobs).updateOne(
      { _id: new ObjectId(printJobId) },
      { $set: { refunded: true } }
    )
  }

  const ok = await refundCredits(
    params.id,
    amount,
    description || '관리자 환불',
    printJobId
  )
  if (!ok) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  }

  const user = await findUserById(params.id)
  return NextResponse.json({ success: true, credits: user?.credits ?? 0 })
}

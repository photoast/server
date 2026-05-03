import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { findEventBySlug, useCredits, createPrintJob } from '@/lib/models'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { amount, eventSlug, imageUrl, quantity } = await request.json()

    if (!amount || !eventSlug || !imageUrl) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 })
    }

    const event = await findEventBySlug(eventSlug)
    if (!event) {
      return NextResponse.json({ error: '이벤트를 찾을 수 없습니다' }, { status: 404 })
    }

    const expectedAmount = (event.price ?? 0) * (quantity || 1)
    if (amount !== expectedAmount) {
      return NextResponse.json({ error: '결제 금액이 올바르지 않습니다' }, { status: 400 })
    }

    const ok = await useCredits(
      session.user.id,
      amount,
      `${event.name} 프린트 ${quantity || 1}매`
    )
    if (!ok) {
      return NextResponse.json({ error: '크레딧이 부족합니다' }, { status: 400 })
    }

    const printQty = quantity || 1
    const jobIds: string[] = []
    for (let i = 0; i < printQty; i++) {
      const job = await createPrintJob({
        eventId: event._id!.toString(),
        printerId: event.printerId,
        imageUrl,
        status: 'PENDING',
        userId: session.user.id,
        paymentAmount: amount / printQty,
      })
      jobIds.push(job._id!.toString())
    }

    return NextResponse.json({ success: true, jobIds })
  } catch (error: any) {
    console.error('Credit payment error:', error)
    return NextResponse.json({ error: error.message || '크레딧 결제 처리 중 오류' }, { status: 500 })
  }
}

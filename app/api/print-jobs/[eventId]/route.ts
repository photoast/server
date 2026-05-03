import { NextRequest, NextResponse } from 'next/server'
import { getPrintJobsByEventId, getAllPrinters, findUserById } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const [{ jobs: printJobs, total }, printers] = await Promise.all([
      getPrintJobsByEventId(params.eventId, { page, limit }),
      getAllPrinters(),
    ])

    const printerMap = new Map(printers.map(p => [p._id!.toString(), p.name]))

    const userIds = Array.from(new Set(printJobs.filter(j => j.userId).map(j => j.userId!)))
    const users = await Promise.all(userIds.map(id => findUserById(id)))
    const userMap = new Map(users.filter(Boolean).map(u => [u!._id!.toString(), { name: u!.name, email: u!.email, profileImage: u!.profileImage }]))

    const enriched = printJobs.map(job => ({
      ...job,
      printerName: job.printerId ? printerMap.get(job.printerId) || null : null,
      userName: job.userId ? userMap.get(job.userId)?.name || null : null,
      userEmail: job.userId ? userMap.get(job.userId)?.email || null : null,
    }))

    return NextResponse.json({
      jobs: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching print jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch print jobs' },
      { status: 500 }
    )
  }
}

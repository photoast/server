import { NextRequest, NextResponse } from 'next/server'
import { getPrintJobsByEventId } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const printJobs = await getPrintJobsByEventId(params.eventId)
    return NextResponse.json(printJobs)
  } catch (error) {
    console.error('Error fetching print jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch print jobs' },
      { status: 500 }
    )
  }
}

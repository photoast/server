import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/middleware'
import { getDb, COLLECTIONS } from '@/lib/mongodb'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const jobs = await db.collection(COLLECTIONS.printJobs)
    .find({ userId: params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return NextResponse.json(jobs)
}

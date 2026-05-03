import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  return NextResponse.json(users)
}

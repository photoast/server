import { NextRequest, NextResponse } from 'next/server'
import memoryDB from '@/lib/memorydb'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const duplicated = await memoryDB.duplicateLayout(params.id)
  if (!duplicated) {
    return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  }
  return NextResponse.json(duplicated, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { duplicateLayout } from '@/lib/models'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const duplicated = await duplicateLayout(params.id)
  if (!duplicated) {
    return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  }
  return NextResponse.json(duplicated, { status: 201 })
}

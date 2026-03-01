import { NextRequest, NextResponse } from 'next/server'
import memoryDB from '@/lib/memorydb'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const layout = await memoryDB.getLayoutById(params.id)
  if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  return NextResponse.json(layout)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const ok = await memoryDB.updateLayout(params.id, body)
    if (!ok) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
    const updated = await memoryDB.getLayoutById(params.id)
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update layout' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ok = await memoryDB.deleteLayout(params.id)
  if (!ok) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

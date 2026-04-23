import { NextRequest, NextResponse } from 'next/server'
import { getLayoutById, updateLayout, deleteLayout } from '@/lib/models'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const layout = await getLayoutById(params.id)
  if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  return NextResponse.json(layout)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const ok = await updateLayout(params.id, body)
    if (!ok) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
    const updated = await getLayoutById(params.id)
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update layout' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ok = await deleteLayout(params.id)
  if (!ok) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

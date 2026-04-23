import { NextRequest, NextResponse } from 'next/server'
import { reorderLayouts } from '@/lib/models'

export async function PATCH(request: NextRequest) {
  try {
    const { orderedIds } = await request.json()
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 })
    }
    await reorderLayouts(orderedIds)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reorder layouts' }, { status: 500 })
  }
}

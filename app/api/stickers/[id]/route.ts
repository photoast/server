import { NextRequest, NextResponse } from 'next/server'
import { deleteSticker } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deleted = await deleteSticker(params.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Sticker not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sticker:', error)
    return NextResponse.json({ error: 'Failed to delete sticker' }, { status: 500 })
  }
}

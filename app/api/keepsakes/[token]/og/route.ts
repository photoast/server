import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { findEventById, getLayoutById } from '@/lib/models'
import { KEEPSAKES, Keepsake, keepsakeHeaders } from '@/lib/keepsake'
import { keepsakeCoverBuffers } from '@/lib/keepsakeCoverServer'
import { renderKeepsakeOg } from '@/lib/keepsakeOg'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  if (!/^[a-f0-9]{48}$/.test(params.token)) return new NextResponse(null, { status: 404, headers: keepsakeHeaders })
  try {
    const db = await getDb()
    const album = await db.collection<Keepsake>(KEEPSAKES).findOne({ _id: params.token })
    if (!album) return new NextResponse(null, { status: 404, headers: keepsakeHeaders })
    const event = await findEventById(album.eventId)
    if (!event) return new NextResponse(null, { status: 404, headers: keepsakeHeaders })
    const layout = event.boothLayoutId ? await getLayoutById(event.boothLayoutId) : null
    return await renderKeepsakeOg(album.title, album.date, await keepsakeCoverBuffers(layout))
  } catch { return NextResponse.json({ error: '공유 이미지를 준비하지 못했어요.' }, { status: 503, headers: keepsakeHeaders }) }
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { findEventById, getLayoutById } from '@/lib/models'
import { KEEPSAKES, Keepsake, keepsakeHeaders } from '@/lib/keepsake'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: keepsakeHeaders })
  if (!/^[a-f0-9]{48}$/.test(params.token)) return reply({ error: '앨범 링크를 확인해 주세요.' }, 404)
  try {
    const db = await getDb()
    const album = await db.collection<Keepsake>(KEEPSAKES).findOne({ _id: params.token })
    if (!album) return reply({ error: '앨범 링크를 확인해 주세요.' }, 404)
    const event = await findEventById(album.eventId)
    if (!event) return reply({ error: '앨범을 찾을 수 없어요.' }, 404)
    const layout = event.boothLayoutId ? await getLayoutById(event.boothLayoutId) : null
    const samples = Array.from(new Set([layout?.testPreviewImageUrl, ...(layout?.previewImageUrls || [])].filter((url): url is string => Boolean(url))))
    const cover = samples.slice(0, 3)
    const page = Math.max(1, Math.min(10000, Math.floor(Number(request.nextUrl.searchParams.get('page'))) || 1))
    const size = 48
    const [result] = await db.collection(COLLECTIONS.printJobs).aggregate([
      { $match: { eventId: album.eventId, layoutId: event.boothLayoutId || '__no_booth_layout__', refunded: { $ne: true }, status: { $in: ['DONE', 'PENDING', 'PRINTING'] }, imageUrl: { $type: 'string', $nin: ['', ...samples] } } },
      { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: '$imageUrl', id: { $first: '$_id' }, capturedAt: { $first: '$createdAt' } } },
      { $sort: { capturedAt: 1, _id: 1 } },
      { $facet: { photos: [{ $skip: (page - 1) * size }, { $limit: size }], count: [{ $count: 'total' }] } },
    ]).toArray()
    const total = result?.count[0]?.total || 0
    return reply({ title: album.title, date: album.date, cover, photos: (result?.photos || []).map((p: { id: unknown; _id: string }) => ({ id: String(p.id), url: p._id })), total, page, hasMore: page * size < total })
  } catch { return reply({ error: '사진을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' }, 503) }
}

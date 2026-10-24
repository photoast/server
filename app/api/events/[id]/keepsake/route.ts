import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { checkAuth } from '@/lib/middleware'
import { findEventById } from '@/lib/models'
import { getDb } from '@/lib/mongodb'
import { KEEPSAKES, Keepsake, keepsakeHeaders } from '@/lib/keepsake'
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 })
  if (!/^[a-f0-9]{24}$/i.test(params.id)) return NextResponse.json({ error: '잘못된 행사입니다.' }, { status: 400 })
  try {
    const body = await request.json()
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 80 || typeof body.date !== 'string' || !/^(|\d{4}-\d{2}-\d{2})$/.test(body.date)) return NextResponse.json({ error: '이름과 날짜를 확인해 주세요.' }, { status: 400 })
    if (!await findEventById(params.id)) return NextResponse.json({ error: '행사가 없습니다.' }, { status: 404 })
    const db = await getDb()
    const col = db.collection<Keepsake>(KEEPSAKES)
    // One link per event, unguessable and stable across edits. No customer account required.
    await col.updateOne({ eventId: params.id }, { $set: { title: body.title.trim(), date: body.date }, $setOnInsert: { _id: randomBytes(24).toString('hex'), eventId: params.id, createdAt: new Date() } }, { upsert: true })
    const album = await col.findOne({ eventId: params.id })
    return NextResponse.json({ url: `/keepsake/${album!._id}` }, { headers: keepsakeHeaders })
  } catch { return NextResponse.json({ error: '선물 앨범 링크를 만들지 못했어요.' }, { status: 500 }) }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = await getDb()
    const album = await db.collection<Keepsake>(KEEPSAKES).findOne({ eventId: params.id })
    return NextResponse.json(album ? { title: album.title, date: album.date, url: `/keepsake/${album._id}` } : null, { headers: keepsakeHeaders })
  } catch { return NextResponse.json({ error: '앨범 설정을 불러오지 못했어요.' }, { status: 503 }) }
}

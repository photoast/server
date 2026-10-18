import { NextRequest, NextResponse } from 'next/server'
import { getLayoutById, updateLayout, deleteLayout } from '@/lib/models'
import { validPoolPhoto } from '@/lib/boothRandomPreviews'
import { checkAuth } from '@/lib/middleware'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const layout = await getLayoutById(params.id)
  if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 })
  return NextResponse.json(layout)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const sampleFields = ['testImageUrls', 'testPreviewImageUrl', 'previewImageUrls', 'boothPreviewSource', 'previewPhotoPool']
    if (sampleFields.some(field => body[field] !== undefined)) {
      if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const validUrl = (value: unknown) => typeof value === 'string' && value.length <= 4000 && /^(https?:\/\/|\/uploads\/|\/api\/serve-image\/)/i.test(value)
      if (body.previewPhotoPool !== undefined && (!Array.isArray(body.previewPhotoPool) || body.previewPhotoPool.length > 50 || !body.previewPhotoPool.every((p: unknown) => validPoolPhoto(p,validUrl)) || new Set(body.previewPhotoPool.map((p: {id:string}) => p.id)).size !== body.previewPhotoPool.length)) {
        return NextResponse.json({ error: '랜덤 사진과 크롭 영역을 확인해 주세요. 최대 50장까지 등록할 수 있어요.' }, { status: 400 })
      }
      if (body.previewImageUrls !== undefined && (!Array.isArray(body.previewImageUrls) || body.previewImageUrls.length > 30 || !body.previewImageUrls.every(validUrl))) {
        return NextResponse.json({ error: '완성 미리보기는 올바른 사진 주소로 최대 30장까지 등록해 주세요.' }, { status: 400 })
      }
      if (body.testPreviewImageUrl !== undefined && body.testPreviewImageUrl !== '' && !validUrl(body.testPreviewImageUrl)) {
        return NextResponse.json({ error: '테스트 미리보기 주소를 확인해 주세요.' }, { status: 400 })
      }
      if (body.testImageUrls !== undefined && (!body.testImageUrls || typeof body.testImageUrls !== 'object' || Array.isArray(body.testImageUrls) || Object.keys(body.testImageUrls).length > 100 || !Object.values(body.testImageUrls).every(validUrl))) {
        return NextResponse.json({ error: '테스트 사진 주소를 확인해 주세요.' }, { status: 400 })
      }
      if (body.boothPreviewSource !== undefined && !['samples', 'prints', 'mixed'].includes(body.boothPreviewSource)) {
        return NextResponse.json({ error: '미리보기 표시 방식을 확인해 주세요.' }, { status: 400 })
      }
    }
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

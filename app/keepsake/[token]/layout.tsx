import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { getDb } from '@/lib/mongodb'
import { findEventById, getLayoutById } from '@/lib/models'
import { KEEPSAKES, Keepsake } from '@/lib/keepsake'
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const base: Metadata = { title: '우리의 하루를 담은 선물', icons: { icon: 'data:,', apple: 'data:,' }, description: '함께 웃었던 순간들을 오래 간직하는 작은 사진 앨범', robots: { index: false, follow: false }, referrer: 'no-referrer' }
  if (!/^[a-f0-9]{48}$/.test(params.token)) return base
  try {
    const db = await getDb()
    const album = await db.collection<Keepsake>(KEEPSAKES).findOne({ _id: params.token })
    if (!album) return base
    const event = await findEventById(album.eventId)
    if (!event) return base
    const layout = event.boothLayoutId ? await getLayoutById(event.boothLayoutId) : null
    const requestHeaders = headers(), host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
    const origin = host && /^[a-z0-9.:[\]-]+$/i.test(host) ? `${requestHeaders.get('x-forwarded-proto') === 'http' || host.startsWith('localhost') ? 'http' : 'https'}://${host}` : process.env.NEXT_PUBLIC_BASE_URL || 'https://phototoast.kro.kr'
    const title = `${album.title} · 우리의 하루를 담은 선물`
    const description = `${album.date ? album.date.replace(/-/g, '.') + ' · ' : ''}함께 웃었던 순간과 축하의 마음을 모았어요. 소중한 사진을 펼쳐보고 오래 간직해 주세요.`
    // Change the thumbnail URL when the cover/title changes, for crawler caches.
    const version = createHash('sha256').update(JSON.stringify([album.title, album.date, layout?.updatedAt, layout?.testPreviewImageUrl, layout?.previewImageUrls, layout?.previewPhotoPool])).digest('hex').slice(0, 12)
    const url = new URL(`/keepsake/${params.token}`, origin).href
    const image = new URL(`/api/keepsakes/${params.token}/og?v=${version}`, origin).href
    return { ...base, title, description, metadataBase: new URL(origin), alternates: { canonical: url }, openGraph: { type: 'website', title, description, url, locale: 'ko_KR', images: [{ url: image, width: 1200, height: 630, alt: `${album.title}의 웨딩 사진 선물 앨범` }] }, twitter: { card: 'summary_large_image', title, description, images: [image] } }
  } catch { return base }
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }

import type { Metadata } from 'next'
import { findEventBySlug } from '@/lib/models'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const event = await findEventBySlug(params.slug)

  if (!event) {
    return { title: 'Photo Toast' }
  }

  const title = `${event.name} | Photo Toast`
  const description = '사진을 선택하고 바로 인쇄하세요'
  const logoUrl = event.logoUrl || '/logo-without-bg.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: logoUrl, width: 200, height: 200 }],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [logoUrl],
    },
  }
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return children
}

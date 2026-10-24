import type { Metadata } from 'next'
export const metadata: Metadata = { title: '우리의 하루를 담은 선물', icons: { icon: 'data:,', apple: 'data:,' }, description: '함께 웃었던 순간들을 오래 간직하는 작은 사진 앨범', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function Layout({ children }: { children: React.ReactNode }) { return children }

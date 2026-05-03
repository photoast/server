import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from './components/AuthProvider'

export const metadata: Metadata = {
  title: 'Photo Toast - Event Photo Printing',
  description: 'Instant photo printing platform for events',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

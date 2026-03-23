import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OneSignalInit } from '@/components/OneSignalInit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MeuBaba',
  description: 'Organize seu baba de futebol com estatisticas, rankings e muito mais!',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MeuBaba',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    type: 'website',
    title: 'MeuBaba',
    description: 'Organize seu baba de futebol!',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MeuBaba" />
      </head>
      <body className={inter.className}>
        <OneSignalInit />
        {children}
      </body>
    </html>
  )
}

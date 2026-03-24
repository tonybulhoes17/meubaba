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
  openGraph: {
    type: 'website',
    title: 'MeuBaba',
    description: 'Organize seu baba de futebol!',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MeuBaba" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <OneSignalInit />
        {children}
      </body>
    </html>
  )
}

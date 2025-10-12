import './globals.css'
import PreloadMetallic from './components/PreloadMetallic'
import type React from 'react'
import { Inter } from 'next/font/google'
import Image from 'next/image'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="app-body">
        {/* Preload metallic layer once for the whole app */}
        <PreloadMetallic />
        <header className="app-header">
          <div className="container app-navbar">
            <div className="brand">
              <Image src="/Monopoly2.PNG" alt="Monopoly" width={3557} height={117} priority style={{ height: 28, width: 'auto', maxWidth: 220, objectFit: 'contain', borderRadius: 6 }} />
              <div>
                <div className="brand-title">Monopoly</div>
                <div className="brand-subtle">arkadaşlarınla Monopoly oyna</div>
              </div>
            </div>
            <div className="spacer" />
          </div>
        </header>
        <main className="container stack">
          {children}
        </main>
      </body>
    </html>
  )
}

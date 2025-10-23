import './globals.css'
import PreloadMetallic from './components/PreloadMetallic'
import type React from 'react'
import localFont from 'next/font/local'
import Image from 'next/image'
import 'tippy.js/dist/tippy.css';

const productSans = localFont({
  src: [
    { path: '../public/fonts/Product Sans Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Product Sans Italic.ttf',  weight: '400', style: 'italic' },
    { path: '../public/fonts/Product Sans Bold.ttf',    weight: '700', style: 'normal' },
    { path: '../public/fonts/Product Sans Bold Italic.ttf', weight: '700', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={productSans.variable}>
      <body className="app-body">
        {/* Preload metallic layer once for the whole app */}
        <PreloadMetallic />
        {/* Background music controls now live in Board3D toolbar */}
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

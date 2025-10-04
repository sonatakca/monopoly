import './globals.css'
import type React from 'react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="app-body">
        <header className="app-header">
          <div className="container app-navbar">
            <div className="brand">
              <div className="brand-badge" />
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

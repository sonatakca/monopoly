export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr"><body style={{ fontFamily: 'ui-sans-serif', maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>MonopolyTR (alpha)</h1>
      {children}
    </body></html>
  )
}

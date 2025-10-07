/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { externalDir: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    const API = process.env.NEXT_PUBLIC_API_URL
    if (!API) return []
    return [
      {
        source: '/api/:path*',
        destination: `${API}/:path*`,
      },
    ]
  },
}
module.exports = nextConfig

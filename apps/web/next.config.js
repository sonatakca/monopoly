/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing from packages/ and other workspace folders
  experimental: { externalDir: true },
  // Skip ESLint during the production build (optional; keeps CI clean)
  eslint: { ignoreDuringBuilds: true },
  // Keep type checking; if this blocks deploy due to external types, we can temporarily disable
  typescript: { ignoreBuildErrors: false },
  // Optional: silence a dev origin warning if you see it
  // allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
}
module.exports = nextConfig

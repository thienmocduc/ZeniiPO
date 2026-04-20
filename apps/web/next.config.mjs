/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/hq-docs', destination: '/academy/handbook', permanent: true },
      { source: '/handbook/:path*', destination: '/academy/handbook/:path*', permanent: true },
      { source: '/training/:path*', destination: '/academy/drills/:path*', permanent: true },
      { source: '/training-hub', destination: '/academy/drills', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig

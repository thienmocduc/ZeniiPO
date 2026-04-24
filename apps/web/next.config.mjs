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
      // Legacy /hq-docs + /handbook → v1_8 Unicorn Playbook DB
      { source: '/hq-docs', destination: '/playbook', permanent: true },
      { source: '/handbook/:path*', destination: '/playbook', permanent: true },
      // /training-hub → v1_8 Training Hub (keep /training/* direct since it
      // is the new route; only /training-hub needs redirect)
      { source: '/training-hub', destination: '/training', permanent: true },
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
    serverComponentsExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  },
  // Ensure v1_8_FULL.html is traced into the server bundle on Vercel so
  // readFileSync at runtime finds it. Next's output file tracer usually
  // can't see arbitrary readFileSync paths — include it explicitly.
  outputFileTracingIncludes: {
    '/**': ['./src/lib/v1/source.html'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push('isomorphic-dompurify', 'jsdom')
      }
    }
    return config
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Increase body size limit for file uploads (4컷 등 여러 사진 업로드 시)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Vercel 서버리스 번들에 한글 폰트 파일 포함
  outputFileTracingIncludes: {
    '/api/**': ['./lib/fonts/**/*'],
  },
}

module.exports = nextConfig

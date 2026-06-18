import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  // Local only: pin workspace root so Next doesn't pick up a parent package-lock.json.
  // On Vercel this breaks output tracing (ENOENT on .next/package.json).
  ...(!process.env.VERCEL
    ? {
        outputFileTracingRoot: projectRoot,
        turbopack: { root: projectRoot },
      }
    : {}),
}

export default nextConfig

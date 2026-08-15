import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// Baseline hardening: blocks arbitrary third-party script/frame origins,
// clickjacking, and MIME-sniffing. Scripts/styles still allow 'unsafe-inline'
// because Next.js/Tailwind/Framer Motion/Radix rely on inline styles and we
// don't yet generate per-request nonces in src/proxy.ts — a stricter
// nonce-based CSP is a good follow-up once that plumbing exists.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://deifkwefumgah.cloudfront.net",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://vitals.vercel-insights.com",
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

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
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
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

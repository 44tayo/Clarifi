import type { Metadata } from 'next'
import { SalesCallDemo } from '@/components/landing/SalesCallDemo'

export const metadata: Metadata = {
  title: 'Sales Call Demo — Clarifi',
  robots: { index: false, follow: false },
}

export default function DemoPage() {
  return <SalesCallDemo />
}

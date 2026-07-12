'use client'

import { useEffect } from 'react'

export default function GreeterLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('SW registration failed (offline reload unavailable)', e)
      })
    }
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/manifest.json'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  return <div className="min-h-screen bg-slate-900 text-slate-100">{children}</div>
}

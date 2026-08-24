'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { HallSceneProps } from '@/lib/scene-builder'

const BallroomCanvas = dynamic(() => import('./BallroomCanvas'), { ssr: false })

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Beat 5 — the one pinned moment in the invite. A 240svh scroll container
 * whose inner frame stays `sticky top-0`; scrolling through it sweeps the
 * camera ~170° around the dressed hall (no route highlight — there's no
 * table yet). The canvas mounts lazily (IO, `rootMargin: '600px 0px'`) and
 * renders on demand, so idle GPU/battery cost is near zero. No WebGL, or
 * before the section is nearby, falls back to `fallback` inside the same
 * gold-framed card.
 */
export function InviteBallroom({ scene, fallback }: { scene: HallSceneProps; fallback: ReactNode }) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [nearby, setNearby] = useState(false)
  const [webgl, setWebgl] = useState(false)
  const [progress, setProgress] = useState(0.5)

  useEffect(() => {
    setWebgl(webglAvailable())
  }, [])

  // Mount the canvas only once the section is within 600px of the viewport.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setNearby(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Drive `progress` from scroll position — passive listener, rAF-throttled.
  // Reduced motion: skip the listener entirely and hold a fixed midpoint.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(0.5)
      return
    }

    let sectionTop = 0
    let sectionHeight = 0
    let viewportH = window.innerHeight
    let raf = 0
    let pending = false

    const measure = () => {
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      sectionTop = rect.top + window.scrollY
      sectionHeight = rect.height
      viewportH = window.innerHeight
    }

    const apply = () => {
      pending = false
      const denom = sectionHeight - viewportH
      const p = denom > 0 ? (window.scrollY - sectionTop) / denom : 0
      setProgress(Math.min(1, Math.max(0, p)))
    }

    const onScroll = () => {
      if (pending) return
      pending = true
      raf = requestAnimationFrame(apply)
    }

    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  const canRender = nearby && webgl

  return (
    <section ref={sectionRef} style={{ height: '240svh' }} className="relative">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center gap-4 px-3">
        <div
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-(--line) bg-[#14100a]"
          style={{ height: '60svh' }}
        >
          {canRender ? <BallroomCanvas scene={scene} progress={progress} /> : fallback}
        </div>
        <p className="gv-caps text-[11px] text-(--ink-faint)">Scroll to look around the ballroom</p>
      </div>
    </section>
  )
}

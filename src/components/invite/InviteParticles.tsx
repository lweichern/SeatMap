'use client'

import { useEffect, useRef, useState } from 'react'

const PARTICLE_COUNT = 18
const COLORS = ['201,164,74', '217,196,142'] as const // #c9a44a, #d9c48e

interface Particle {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  color: (typeof COLORS)[number]
}

function spawn(width: number, height: number, y?: number): Particle {
  return {
    x: Math.random() * width,
    y: y ?? Math.random() * height,
    r: 1.5 + Math.random() * 2,
    vx: -(0.08 + Math.random() * 0.22),
    vy: 0.06 + Math.random() * 0.16,
    alpha: 0.3 + Math.random() * 0.4,
    color: COLORS[Math.random() < 0.5 ? 0 : 1],
  }
}

/**
 * Gold-dust drift behind the hero. Defaults to rendering nothing (matches
 * SSR) until an effect confirms motion is actually wanted — so
 * reduced-motion users never see even a first-frame flash of dots.
 */
export function InviteParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let width = 0
    let height = 0
    let particles: Particle[] = []
    let raf = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (particles.length === 0) {
        particles = Array.from({ length: PARTICLE_COUNT }, () => spawn(width, height))
      }
    }

    function tick() {
      ctx!.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.y > height + 8) {
          p.y = -8
          p.x = Math.random() * width
        }
        if (p.x < -8) p.x = width + 8
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(${p.color},${p.alpha})`
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    function start() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    function stop() {
      cancelAnimationFrame(raf)
    }
    function onVisibility() {
      if (document.hidden) stop()
      else start()
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])

  if (!active) return null

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
}

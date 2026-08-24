const COLORS = ['#c9a44a', '#d9c48e', '#8a6a1f', '#fffdf6'] as const
const COUNT = 120
const DURATION_MS = 1800
const GRAVITY = 0.22
const DRAG = 0.985

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  vrot: number
  color: (typeof COLORS)[number]
  shape: 'rect' | 'circle'
}

/**
 * One-shot gold confetti burst for the RSVP "accept" moment. Creates a
 * fixed full-screen canvas, drops ~120 gold particles (rects + circles)
 * from just above center with gravity + drag for ~1.8s, then removes the
 * canvas. No-op under `prefers-reduced-motion` — the celebration is a
 * flourish, never load-bearing for the flow underneath it.
 */
export function burstConfetti(): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.zIndex = '9999'
  canvas.style.pointerEvents = 'none'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const particles: Particle[] = Array.from({ length: COUNT }, () => ({
    x: width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: height * 0.25 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 8,
    vy: -(4 + Math.random() * 6),
    size: 4 + Math.random() * 5,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() < 0.5 ? 'rect' : 'circle',
  }))

  const start = performance.now()
  let raf = 0

  function tick(now: number) {
    const elapsed = now - start
    ctx!.clearRect(0, 0, width, height)
    for (const p of particles) {
      p.vy += GRAVITY
      p.vx *= DRAG
      p.vy *= DRAG
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vrot
      ctx!.save()
      ctx!.translate(p.x, p.y)
      ctx!.rotate(p.rot)
      ctx!.fillStyle = p.color
      if (p.shape === 'rect') {
        ctx!.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
      } else {
        ctx!.beginPath()
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.restore()
    }
    if (elapsed < DURATION_MS) {
      raf = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(raf)
      canvas.remove()
    }
  }

  raf = requestAnimationFrame(tick)
}

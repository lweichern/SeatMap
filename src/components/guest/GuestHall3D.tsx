'use client'

import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { HallScene, sceneBounds, type HallSceneProps } from '@/lib/scene-builder'

type Controls = ComponentRef<typeof OrbitControls>

/**
 * The guest's 3D view — the SAME HallScene the planner previews, plus the
 * "wow" fly-in and dead-simple controls: zoom buttons, a "show me my table"
 * replay, a gentle idle orbit, and a gesture hint that fades away. Grabbing
 * the scene at any moment hands over control instantly.
 */
export default function GuestHall3D(props: HallSceneProps) {
  const b = sceneBounds(props)
  const controlsRef = useRef<Controls | null>(null)
  const [ride, setRide] = useState(0) // bump to replay the fly-in
  const [spin, setSpin] = useState(false)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    setHint(true)
    const t = setTimeout(() => setHint(false), 6500)
    return () => clearTimeout(t)
  }, [ride])

  const zoom = (factor: number) => {
    const c = controlsRef.current
    if (!c) return
    const cam = c.object
    const offset = cam.position.clone().sub(c.target)
    const dist = THREE.MathUtils.clamp(offset.length() * factor, c.minDistance, c.maxDistance)
    cam.position.copy(c.target).add(offset.normalize().multiplyScalar(dist))
    c.update()
  }

  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full border border-[#d9c48e]/30 bg-[#241a0e]/85 text-xl leading-none text-[#e8d9ae] shadow-lg backdrop-blur-sm transition-transform active:scale-90'

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        camera={{ fov: 45, position: [b.cx, b.span * 1.1, b.cy + b.span * 0.8] }}
        style={{ touchAction: 'none' }}
      >
        <color attach="background" args={['#14100a']} />
        <HallScene {...props} />
        <FlyIn
          key={ride}
          {...props}
          controlsRef={controlsRef}
          spin={spin}
          onArrive={() => setSpin(true)}
          onGrab={() => setSpin(false)}
        />
      </Canvas>

      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button aria-label="Zoom in" className={btn} onClick={() => zoom(0.72)}>
          ＋
        </button>
        <button aria-label="Zoom out" className={btn} onClick={() => zoom(1.4)}>
          −
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-4">
        {hint && (
          <p
            className="rounded-full bg-[#241a0e]/80 px-4 py-1.5 text-center text-[12px] text-[#e8d9ae] backdrop-blur-sm"
            style={{ animation: 'gvHintOut 6.5s forwards' }}
          >
            Drag to look around · pinch or scroll to zoom
          </p>
        )}
        <button
          onClick={() => {
            setSpin(false)
            setRide((r) => r + 1)
          }}
          className="pointer-events-auto rounded-full border border-[#d9c48e]/40 bg-[#241a0e]/85 px-5 py-2.5 text-[13px] font-semibold tracking-wide text-[#f0e2b8] shadow-lg backdrop-blur-sm transition-transform active:scale-95"
        >
          {props.highlightTableId ? '✦ Show me my table' : '✦ Reset view'}
        </button>
      </div>
    </div>
  )
}

function FlyIn({
  controlsRef,
  spin,
  onArrive,
  onGrab,
  ...props
}: HallSceneProps & {
  controlsRef: RefObject<Controls | null>
  spin: boolean
  onArrive: () => void
  onGrab: () => void
}) {
  const start = useRef<number | null>(null)
  const done = useRef(false)
  const b = sceneBounds(props)
  const table = props.tables.find((t) => t.id === props.highlightTableId)

  const from = useMemo(
    () => new THREE.Vector3(b.cx, b.span * 1.1, b.cy + b.span * 0.8),
    [b.cx, b.cy, b.span],
  )
  const target = useMemo(
    () => (table ? new THREE.Vector3(table.x, 0.8, table.y) : new THREE.Vector3(b.cx, 0, b.cy)),
    [table, b.cx, b.cy],
  )
  const to = useMemo(() => target.clone().add(new THREE.Vector3(5, 6.5, 6)), [target])

  // "Walk in from the entrance": a slow, smooth camera dolly that starts
  // just outside the doorway, follows the guest's actual walking route a
  // few metres above the floor, and rises into the final orbit view of
  // their table. Falls back to the overview drop when there is no route.
  const walk = useMemo(() => {
    const route = props.route
    const path = route?.path
    if (!table || !route || !path || path.length < 2) return null
    const rs = resamplePath(path, 14)
    if (!rs) return null
    const { pts, total } = rs
    // arc distance of the doorway along the path (0 when there is no door)
    let doorArc = 0
    if (route.doorIndex > 0 && route.doorIndex < path.length) {
      for (let i = 1; i <= route.doorIndex; i++)
        doorArc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    }
    // walk low until we're through the door AND still ~4.5 m short of the
    // table — never nose-up against the chairs — then rise to the view
    const cutoff = Math.min(Math.max(doorArc + 1.2, total - 4.5), total - 1.5)
    const per = total / (pts.length - 1)
    // start IN the doorway (the desk label stays behind the camera) and
    // walk the aisle low; distant tables get a longer walk automatically
    const fromArc = Math.max(0, doorArc - 0.6)
    const keep = pts.filter((_, i) => i * per >= fromArc && i * per <= cutoff)
    if (keep.length < 2) return null
    const dx = keep[1].x - keep[0].x
    const dy = keep[1].y - keep[0].y
    const len = Math.hypot(dx, dy) || 1
    const cam: THREE.Vector3[] = [
      // just outside the threshold, person-height, below the 2.4 m lintel
      new THREE.Vector3(keep[0].x - (dx / len) * 2.2, 2.2, keep[0].y - (dy / len) * 2.2),
      ...keep.map((pnt) => new THREE.Vector3(pnt.x, 2.1, pnt.y)),
      to.clone(), // then sweep up and aside into the orbit view
    ]
    // centripetal: hugs the waypoints — no corner-cutting through the doorway wall
    return new THREE.CatmullRomCurve3(cam, false, 'centripetal')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.route, table, to])

  useFrame(({ camera, clock }) => {
    if (done.current) return
    if (start.current === null) start.current = clock.elapsedTime
    const t = Math.min((clock.elapsedTime - start.current) / (walk ? 6.0 : 2.6), 1)
    if (walk) {
      const e = t * t * (3 - 2 * t) // smoothstep: gentle start and landing
      camera.position.copy(walk.getPointAt(e))
      // gaze at the floor a little ahead on the route, easing onto the table
      const ahead = walk.getPointAt(Math.min(1, e + 0.18))
      const look = new THREE.Vector3(ahead.x, 1.2, ahead.z)
      // the spotlit table takes over the gaze from mid-walk — bright frames
      look.lerp(target, THREE.MathUtils.smoothstep(e, 0.3, 0.75))
      camera.lookAt(look)
      if (controlsRef.current) controlsRef.current.target.copy(look)
    } else {
      const e = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(from, to, e)
      const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(b.cx, 0, b.cy), target, e)
      camera.lookAt(look)
      if (controlsRef.current) controlsRef.current.target.copy(look)
    }
    if (t >= 1) {
      done.current = true
      onArrive()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      autoRotate={spin}
      autoRotateSpeed={0.6}
      onStart={() => {
        // the guest grabbed the scene — cancel the flight and the idle orbit
        done.current = true
        onGrab()
      }}
      minDistance={4}
      maxDistance={b.span * 1.6}
      minPolarAngle={Math.PI * (15 / 180)}
      maxPolarAngle={Math.PI * (75 / 180)}
    />
  )
}

/** Evenly resample a route polyline so A* waypoint density can't kink the camera curve. */
function resamplePath(path: { x: number; y: number }[], steps: number) {
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    lens.push(d)
    total += d
  }
  if (total < 1) return null
  const out = [path[0]]
  // (returns evenly spaced points and the polyline's total length)
  const step = total / steps
  let next = step
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const d = lens[i - 1]
    while (acc + d >= next && out.length < steps) {
      const f = (next - acc) / d
      out.push({
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * f,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * f,
      })
      next += step
    }
    acc += d
  }
  out.push(path[path.length - 1])
  return { pts: out, total }
}

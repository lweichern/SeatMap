'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { seatPositions } from './table-geometry'
import { labelTexture, type LabelStyle } from './labels'
import type { RouteResult } from './pathfinding'
import type { Stage, TableObj, Wall } from './types'

/**
 * Builds the R3F scene from Venue + TableObj[] — used by BOTH the editor's
 * live preview and the guest view (/g/{token}). Same data, same geometry
 * functions, so they physically cannot disagree.
 *
 * World mapping: plan (x, y) metres → world (x, 0, y); +Y is up.
 */

export interface HallSceneProps {
  walls: Wall[]
  door: { x: number; y: number } | null
  doorWidthM: number
  registration: { x: number; y: number } | null
  stage: Stage | null
  tables: TableObj[]
  highlightTableId: string | null
  route: RouteResult | null
  /** Fallback floor size when there are no walls yet. */
  fallbackSpan?: { w: number; h: number }
}

const WALL_H = 3
const FLOOR_COLOR = '#15120F' // darken the floor: cheapest contrast win available
const MUTED = '#6b7280'
const SERVICE_COLOR = '#8c4a2f' // warm brown-red: clearly non-seating

export function sceneBounds(p: HallSceneProps): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  cx: number
  cy: number
  span: number
} {
  const xs: number[] = []
  const ys: number[] = []
  for (const w of p.walls) xs.push(w.x1, w.x2), ys.push(w.y1, w.y2)
  for (const t of p.tables) xs.push(t.x), ys.push(t.y)
  if (p.registration) xs.push(p.registration.x), ys.push(p.registration.y)
  if (xs.length === 0) {
    xs.push(0, p.fallbackSpan?.w ?? 30)
    ys.push(0, p.fallbackSpan?.h ?? 20)
  }
  const minX = Math.min(...xs) - 3
  const maxX = Math.max(...xs) + 3
  const minY = Math.min(...ys) - 3
  const maxY = Math.max(...ys) + 3
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    span: Math.max(maxX - minX, maxY - minY),
  }
}

export function HallScene(props: HallSceneProps) {
  const b = sceneBounds(props)
  return (
    <group>
      <ambientLight intensity={0.75} />
      <directionalLight position={[b.cx + 12, 24, b.cy + 6]} intensity={1.15} />

      {/* floor extends past the walls to cover the foyer */}
      <mesh position={[b.cx, -0.01, b.cy]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[b.maxX - b.minX + 8, b.maxY - b.minY + 8]} />
        <meshStandardMaterial color={FLOOR_COLOR} />
      </mesh>

      {props.walls.map((w, i) => (
        <WallMesh key={i} w={w} door={props.door} doorWidthM={props.doorWidthM} />
      ))}

      {props.stage && <StageMesh stage={props.stage} />}
      {props.registration && <RegistrationDesk p={props.registration} />}
      {props.door && (
        <LabelSprite
          text="DOOR"
          pos={[props.door.x, 2.9, props.door.y]}
          style={{ fontPx: 40, fg: '#a7f3d0', bg: 'rgba(6,78,59,0.85)' }}
          height={0.42}
        />
      )}

      {props.tables.map((t) => (
        <TableMesh3D key={t.id} t={t} highlighted={t.id === props.highlightTableId} />
      ))}

      {props.route && <RouteDots route={props.route} />}
    </group>
  )
}

/** Walls are boxes SPLIT around the doorway, with a lintel above the gap. */
function WallMesh({
  w,
  door,
  doorWidthM,
}: {
  w: Wall
  door: { x: number; y: number } | null
  doorWidthM: number
}) {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const angle = -Math.atan2(dy, dx)
  const seg = (t0: number, t1: number, y: number, h: number, key: string) => {
    const mx = w.x1 + (dx * (t0 + t1)) / 2
    const my = w.y1 + (dy * (t0 + t1)) / 2
    const sl = len * (t1 - t0)
    if (sl < 0.01) return null
    return (
      <mesh key={key} position={[mx, y + h / 2, my]} rotation={[0, angle, 0]}>
        <boxGeometry args={[sl, h, 0.2]} />
        <meshStandardMaterial color="#4a5568" transparent opacity={0.6} />
      </mesh>
    )
  }

  if (door) {
    const t = ((door.x - w.x1) * dx + (door.y - w.y1) * dy) / (len * len)
    const tc = Math.max(0, Math.min(1, t))
    const onWall = Math.hypot(w.x1 + tc * dx - door.x, w.y1 + tc * dy - door.y) < 0.2
    if (onWall) {
      const half = doorWidthM / 2 / len
      const a = Math.max(0, t - half)
      const b = Math.min(1, t + half)
      return (
        <group>
          {seg(0, a, 0, WALL_H, 'a')}
          {seg(b, 1, 0, WALL_H, 'b')}
          {/* lintel — reads as a doorway, not a hole */}
          {seg(a, b, 2.3, WALL_H - 2.3, 'lintel')}
        </group>
      )
    }
  }
  return seg(0, 1, 0, WALL_H, 'full')
}

function StageMesh({ stage }: { stage: Stage }) {
  return (
    <group position={[stage.x + stage.w / 2, 0, stage.y + stage.h / 2]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[stage.w, 0.6, stage.h]} />
        <meshStandardMaterial color="#6d28d9" />
      </mesh>
      <LabelSprite
        text="STAGE"
        pos={[0, 2.2, 0]}
        style={{ fontPx: 44, fg: '#ede9fe', bg: 'rgba(76,29,149,0.85)' }}
        height={0.5}
      />
    </group>
  )
}

function RegistrationDesk({ p }: { p: { x: number; y: number } }) {
  return (
    <group position={[p.x, 0, p.y]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 1.0, 0.7]} />
        <meshStandardMaterial color="#0e7490" />
      </mesh>
      {/* soft floor glow */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 40]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <LabelSprite
        text="REGISTRATION"
        pos={[0, 2.1, 0]}
        style={{ fontPx: 36, fg: '#cffafe', bg: 'rgba(21,94,117,0.85)' }}
        height={0.42}
      />
    </group>
  )
}

const CHAIR_COLOR = '#3f4756'

function TableMesh3D({ t, highlighted }: { t: TableObj; highlighted: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (highlighted && matRef.current) {
      matRef.current.emissiveIntensity = 0.65 + Math.sin(clock.elapsedTime * 2.4) * 0.3
    }
  })

  const service = t.kind === 'service'
  const color = highlighted ? '#f5b52e' : service ? SERVICE_COLOR : MUTED
  const emissive = highlighted ? '#f59e0b' : '#000000'
  const seats = seatPositions(t)
  const rotY = -(((t.rot ?? 0) * Math.PI) / 180)
  const topH = service ? 0.88 : 0.75
  const len = t.len ?? 2
  const wid = t.wid ?? 1

  const mat = (
    <meshStandardMaterial
      ref={highlighted ? matRef : undefined}
      color={color}
      emissive={emissive}
      emissiveIntensity={highlighted ? 0.75 : 0}
    />
  )

  return (
    <group position={[t.x, 0, t.y]}>
      <group rotation={[0, rotY, 0]}>
        {t.shape === 'round' && (
          <>
            <mesh position={[0, topH - 0.04, 0]}>
              <cylinderGeometry args={[(t.dia ?? 1.8) / 2, (t.dia ?? 1.8) / 2, 0.08, 36]} />
              {mat}
            </mesh>
            <mesh position={[0, (topH - 0.08) / 2, 0]}>
              <cylinderGeometry args={[0.12, 0.25, topH - 0.08, 12]} />
              <meshStandardMaterial color="#2f353f" />
            </mesh>
          </>
        )}
        {t.shape === 'oval' && (
          <>
            <mesh position={[0, topH - 0.04, 0]} scale={[len / 2, 1, wid / 2]}>
              <cylinderGeometry args={[1, 1, 0.08, 40]} />
              {mat}
            </mesh>
            <mesh position={[0, (topH - 0.08) / 2, 0]} scale={[len / 4, 1, wid / 4]}>
              <cylinderGeometry args={[0.5, 0.7, topH - 0.08, 16]} />
              <meshStandardMaterial color="#2f353f" />
            </mesh>
          </>
        )}
        {(t.shape === 'banquet' || t.shape === 'square' || t.shape === 'buffet') && (
          <>
            <mesh position={[0, topH - 0.04, 0]}>
              <boxGeometry args={[len, 0.08, wid]} />
              {mat}
            </mesh>
            {[-1, 1].flatMap((sx) =>
              [-1, 1].map((sz) => (
                <mesh
                  key={`${sx}${sz}`}
                  position={[sx * (len / 2 - 0.08), (topH - 0.08) / 2, sz * (wid / 2 - 0.08)]}
                >
                  <boxGeometry args={[0.08, topH - 0.08, 0.08]} />
                  <meshStandardMaterial color="#2f353f" />
                </mesh>
              )),
            )}
            {/* chafing dishes make a buffet legible as a buffet */}
            {service &&
              Array.from({ length: Math.max(1, Math.floor(len / 0.9)) }, (_, i) => {
                const count = Math.max(1, Math.floor(len / 0.9))
                const lx = -len / 2 + (len * (i + 0.5)) / count
                return (
                  <group key={i} position={[lx, topH + 0.08, 0]}>
                    <mesh>
                      <boxGeometry args={[0.55, 0.12, 0.38]} />
                      <meshStandardMaterial color="#c8ccd4" metalness={0.6} roughness={0.35} />
                    </mesh>
                    <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.17, 0.17, 0.5, 16, 1, false, 0, Math.PI]} />
                      <meshStandardMaterial color="#dde1e7" metalness={0.7} roughness={0.3} />
                    </mesh>
                  </group>
                )
              })}
          </>
        )}
      </group>

      {/* chairs — from seatPositions(), the single source of truth */}
      {seats.map((sp, i) => (
        <group key={i} position={[sp.x - t.x, 0, sp.y - t.y]} rotation={[0, -sp.a, 0]}>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.42, 0.48, 0.42]} />
            <meshStandardMaterial color={highlighted ? '#b07818' : CHAIR_COLOR} />
          </mesh>
          {/* backrest on the outward side */}
          <mesh position={[0.19, 0.66, 0]}>
            <boxGeometry args={[0.06, 0.5, 0.42]} />
            <meshStandardMaterial color={highlighted ? '#b07818' : CHAIR_COLOR} />
          </mesh>
        </group>
      ))}

      {highlighted && (
        <>
          <mesh position={[0, 2.8, 0]}>
            <cylinderGeometry args={[0.5, 1.6, 4.2, 24, 1, true]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <pointLight position={[0, 3.2, 0]} color="#fbbf24" intensity={14} distance={9} />
        </>
      )}

      <TableLabel t={t} highlighted={highlighted} />
    </group>
  )
}

function TableLabel({ t, highlighted }: { t: TableObj; highlighted: boolean }) {
  const ref = useRef<THREE.Sprite>(null)
  const base = highlighted ? 2.6 : 1.55
  useFrame(({ clock }) => {
    if (highlighted && ref.current) {
      ref.current.position.y = base + Math.sin(clock.elapsedTime * 1.6) * 0.12 // gentle bob
    }
  })
  const style: LabelStyle = highlighted
    ? {
        fontPx: 84,
        fg: '#231303',
        bg: '#fbbf24',
        border: '#92610b',
        sub: t.seats ? `${t.seats} seats` : undefined,
        subFg: '#5c3d05',
      }
    : t.kind === 'service'
      ? { fontPx: 34, fg: '#fed7aa', bg: 'rgba(64,32,18,0.85)' }
      : { fontPx: 40, fg: '#cbd5e1', bg: 'rgba(15,23,42,0.75)' }
  const text = t.kind === 'seat' && highlighted ? `TABLE ${t.label}` : t.label
  return (
    <LabelSprite
      spriteRef={ref}
      text={text}
      pos={[0, base, 0]}
      style={style}
      height={highlighted ? 0.95 : 0.4}
    />
  )
}

/**
 * ⚠️ Labels draw ON TOP of geometry (depthTest false) — counter-intuitive in
 * 3D but correct: a table number hidden behind a wall is useless. Signage
 * reads through obstacles, like a hanging sign in a real ballroom.
 */
function LabelSprite({
  text,
  pos,
  style,
  height,
  spriteRef,
}: {
  text: string
  pos: [number, number, number]
  style: LabelStyle
  height: number
  spriteRef?: React.RefObject<THREE.Sprite | null>
}) {
  const { texture, aspect } = useMemo(() => labelTexture(text, style), [text, style])
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true,
      }),
    [texture],
  )
  // dispose materials on teardown; deliberately NOT the cached texture
  useMemo(() => () => material.dispose(), [material])
  return (
    <sprite
      ref={spriteRef}
      position={pos}
      scale={[height * aspect, height, 1]}
      material={material}
      renderOrder={999}
    />
  )
}

/** Resample the route polyline at a fixed real-distance step. */
function sampleRoute(path: { x: number; y: number }[], step: number) {
  const out: { x: number; y: number }[] = []
  if (path.length === 0) return out
  let acc = 0
  out.push(path[0])
  for (let i = 1; i < path.length; i++) {
    let ax = path[i - 1].x
    let ay = path[i - 1].y
    const bx = path[i].x
    const by = path[i].y
    let seg = Math.hypot(bx - ax, by - ay)
    while (acc + seg >= step) {
      const t = (step - acc) / seg
      const nx = ax + (bx - ax) * t
      const ny = ay + (by - ay) * t
      out.push({ x: nx, y: ny })
      ax = nx
      ay = ny
      seg = Math.hypot(bx - ax, by - ay)
      acc = 0
    }
    acc += seg
  }
  return out
}

/**
 * ⚠️ Flat DISCS on the floor, not spheres — a disc presents its full face to
 * the camera and reads as a footprint. Core + halo per dot. A brightness
 * wave sweeps desk → table, overshoots and HOLDS (a landing wave says
 * "destination"; a looping one says "track").
 */
function RouteDots({ route }: { route: RouteResult }) {
  const dots = useMemo(() => {
    const sampled = sampleRoute(route.path, 0.62)
    // door index within the sampled dots (nearest sample to the door waypoint)
    let doorDot = -1
    if (route.doorIndex >= 0 && route.doorIndex < route.path.length) {
      const dp = route.path[route.doorIndex]
      let bd = Infinity
      sampled.forEach((p, i) => {
        const d = Math.hypot(p.x - dp.x, p.y - dp.y)
        if (d < bd) {
          bd = d
          doorDot = i
        }
      })
    }
    return { sampled, doorDot }
  }, [route])

  const coreRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const startRef = useRef<number | null>(null)

  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const t = clock.elapsedTime - startRef.current
    const n = dots.sampled.length
    // wave position overshoots the end and holds there
    const wave = Math.min(t * 9, n + 14)
    for (let i = 0; i < n; i++) {
      const m = coreRefs.current[i]
      if (!m) continue
      const d = Math.abs(i - wave)
      const pulse = Math.max(0, 1 - (d * d) / 36) // squared falloff → discrete pulse
      m.opacity = 0.55 + 0.45 * pulse // resting 0.55: path legible without the wave
    }
  })

  const bad = !route.ok
  const colorFor = (i: number) => {
    if (bad) return '#ef4444'
    if (route.squeeze) return '#f59e0b'
    return dots.doorDot >= 0 && i <= dots.doorDot ? '#2dd4bf' : '#60a5fa' // teal foyer, blue hall
  }

  return (
    <group>
      {dots.sampled.map((p, i) => (
        <group key={i} position={[p.x, 0.025, p.y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.13, 20]} />
            <meshBasicMaterial
              ref={(m) => {
                coreRefs.current[i] = m
              }}
              color={colorFor(i)}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <circleGeometry args={[0.28, 20]} />
            <meshBasicMaterial color={colorFor(i)} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

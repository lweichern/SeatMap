'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Entrance, Stage, VenueTable, Wall } from '@/lib/types'

export interface Hall3DProps {
  widthM: number
  heightM: number
  walls: Wall[]
  stage: Stage | null
  entrance: Entrance | null
  tables: VenueTable[]
  guestTableId: string | null
}

/**
 * Procedural 3D hall — built entirely from the 2D floor-plan data.
 * Plan (x, y) maps to world (x - w/2, 0, y - h/2); y is up.
 */
export default function Hall3D(props: Hall3DProps) {
  const { widthM: w, heightM: h } = props
  const guestTable = props.tables.find((t) => t.id === props.guestTableId) ?? null
  const tx = (x: number) => x - w / 2
  const tz = (y: number) => y - h / 2

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, Math.max(w, h) * 1.1, h * 0.9], fov: 45 }}
      // preserveDrawingBuffer: guests screenshot their table to share it
      gl={{ preserveDrawingBuffer: true }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 25, 8]} intensity={1.2} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* walls */}
      {props.walls.map((wall, i) => {
        const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
        if (len === 0) return null
        const cx = tx((wall.x1 + wall.x2) / 2)
        const cz = tz((wall.y1 + wall.y2) / 2)
        const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1)
        return (
          <mesh key={i} position={[cx, 1.25, cz]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[len, 2.5, 0.2]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.55} />
          </mesh>
        )
      })}

      {/* stage */}
      {props.stage && (
        <group
          position={[
            tx(props.stage.x + props.stage.w / 2),
            0.3,
            tz(props.stage.y + props.stage.h / 2),
          ]}
        >
          <mesh>
            <boxGeometry args={[props.stage.w, 0.6, props.stage.h]} />
            <meshStandardMaterial color="#7c3aed" />
          </mesh>
          <Html position={[0, 0.6, 0]} center zIndexRange={[10, 0]}>
            <span className="pointer-events-none select-none text-xs font-bold tracking-widest text-purple-200">
              STAGE
            </span>
          </Html>
        </group>
      )}

      {/* entrance marker */}
      {props.entrance && (
        <group position={[tx(props.entrance.x), 0.02, tz(props.entrance.y)]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.6, 32]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <Html position={[0, 0.3, 1.2]} center zIndexRange={[10, 0]}>
            <span className="pointer-events-none select-none text-[10px] font-bold tracking-widest text-emerald-300">
              ENTRANCE
            </span>
          </Html>
        </group>
      )}

      {/* tables */}
      {props.tables.map((t) => (
        <TableMesh
          key={t.id}
          table={t}
          x={tx(t.x)}
          z={tz(t.y)}
          isGuest={t.id === props.guestTableId}
        />
      ))}

      {/* path from entrance to the guest's table */}
      {props.entrance && guestTable && (
        <FlowPath
          points={pathPoints(props.entrance, guestTable, tx, tz)}
        />
      )}

      <CameraRig
        target={
          guestTable
            ? new THREE.Vector3(tx(guestTable.x), 0.8, tz(guestTable.y))
            : new THREE.Vector3(0, 0, 0)
        }
        hallSize={Math.max(w, h)}
      />
    </Canvas>
  )
}

/** L-shaped route: entrance → walk up/down to the table's row → across. */
function pathPoints(
  entrance: Entrance,
  table: VenueTable,
  tx: (x: number) => number,
  tz: (y: number) => number,
): THREE.Vector3[] {
  const y = 0.08
  return [
    new THREE.Vector3(tx(entrance.x), y, tz(entrance.y)),
    new THREE.Vector3(tx(entrance.x), y, tz(table.y)),
    new THREE.Vector3(tx(table.x), y, tz(table.y)),
  ]
}

function TableMesh({
  table,
  x,
  z,
  isGuest,
}: {
  table: VenueTable
  x: number
  z: number
  isGuest: boolean
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (isGuest && matRef.current) {
      matRef.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 2.4) * 0.35
    }
  })
  const r = (table.w_m && table.shape === 'rect' ? Math.max(table.w_m, table.h_m ?? table.w_m) : table.diameter_m) / 2

  return (
    <group position={[x, 0, z]}>
      {table.shape === 'rect' ? (
        <mesh position={[0, 0.375, 0]}>
          <boxGeometry args={[table.w_m ?? table.diameter_m, 0.75, table.h_m ?? table.diameter_m]} />
          <meshStandardMaterial
            ref={isGuest ? matRef : undefined}
            color={isGuest ? '#fbbf24' : '#64748b'}
            emissive={isGuest ? '#f59e0b' : '#000000'}
            emissiveIntensity={isGuest ? 0.8 : 0}
          />
        </mesh>
      ) : (
        <mesh position={[0, 0.375, 0]}>
          <cylinderGeometry args={[table.diameter_m / 2, table.diameter_m / 2, 0.75, 32]} />
          <meshStandardMaterial
            ref={isGuest ? matRef : undefined}
            color={isGuest ? '#fbbf24' : '#64748b'}
            emissive={isGuest ? '#f59e0b' : '#000000'}
            emissiveIntensity={isGuest ? 0.8 : 0}
          />
        </mesh>
      )}
      <Html position={[0, isGuest ? 1.8 : 1.2, 0]} center zIndexRange={[20, 0]}>
        <span
          className={`pointer-events-none select-none font-black ${
            isGuest
              ? 'rounded-full bg-amber-400 px-2.5 py-0.5 text-lg text-amber-950 shadow-lg'
              : 'text-sm text-slate-300'
          }`}
        >
          {table.label}
        </span>
      </Html>
      {isGuest && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[r + 0.3, r + 0.55, 48]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}

/** Dashed line with the dashes flowing toward the table. */
function FlowPath({ points }: { points: THREE.Vector3[] }) {
  const ref = useRef<React.ComponentRef<typeof Line>>(null)
  useFrame(({ clock }) => {
    const mat = ref.current?.material as (THREE.Material & { dashOffset?: number }) | undefined
    if (mat) mat.dashOffset = -clock.elapsedTime * 1.5
  })
  return (
    <Line
      ref={ref}
      points={points}
      color="#34d399"
      lineWidth={3}
      dashed
      dashSize={0.6}
      gapSize={0.35}
    />
  )
}

/**
 * The "wow" fly-in: start high over the hall, ease down to frame the guest's
 * table. Hands control to OrbitControls afterwards.
 */
function CameraRig({ target, hallSize }: { target: THREE.Vector3; hallSize: number }) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const start = useRef<number | null>(null)
  const done = useRef(false)
  const from = useMemo(() => new THREE.Vector3(0, hallSize * 1.15, hallSize * 0.85), [hallSize])
  const to = useMemo(
    () => target.clone().add(new THREE.Vector3(5, 6.5, 6)),
    [target],
  )

  useFrame(({ camera, clock }) => {
    if (done.current) return
    if (start.current === null) start.current = clock.elapsedTime
    const t = Math.min((clock.elapsedTime - start.current) / 2.6, 1)
    const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
    camera.position.lerpVectors(from, to, e)
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), target, e)
    camera.lookAt(look)
    if (controlsRef.current) controlsRef.current.target.copy(look)
    if (t >= 1) done.current = true
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={4}
      maxDistance={hallSize * 1.6}
      maxPolarAngle={Math.PI * 0.46}
    />
  )
}

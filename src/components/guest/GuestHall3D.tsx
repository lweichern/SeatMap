'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { HallScene, sceneBounds, type HallSceneProps } from '@/lib/scene-builder'

/**
 * The guest's 3D view — the SAME HallScene the planner previews, plus the
 * "wow" fly-in (a straight lerp; no pathfinding for the camera).
 */
export default function GuestHall3D(props: HallSceneProps) {
  const b = sceneBounds(props)
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{ fov: 45, position: [b.cx, b.span * 1.1, b.cy + b.span * 0.8] }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0b0e14']} />
      <HallScene {...props} />
      <FlyIn {...props} />
    </Canvas>
  )
}

function FlyIn(props: HallSceneProps) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
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

  useFrame(({ camera, clock }) => {
    if (done.current) return
    if (start.current === null) start.current = clock.elapsedTime
    const t = Math.min((clock.elapsedTime - start.current) / 2.6, 1)
    const e = 1 - Math.pow(1 - t, 3)
    camera.position.lerpVectors(from, to, e)
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(b.cx, 0, b.cy), target, e)
    camera.lookAt(look)
    if (controlsRef.current) controlsRef.current.target.copy(look)
    if (t >= 1) done.current = true
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={4}
      maxDistance={b.span * 1.6}
      minPolarAngle={Math.PI * (15 / 180)}
      maxPolarAngle={Math.PI * (75 / 180)}
    />
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HallScene, sceneBounds, type HallSceneProps } from '@/lib/scene-builder'

/**
 * The editor's live 3D preview. 3/4 isometric, polar clamped.
 *
 * ⚠️ Rebuilding the scene must never touch the camera — only reframe when
 * the room's bounding SPAN actually changes. Otherwise editing a seat count
 * yanks the zoom back on every keystroke.
 */
export default function Preview3D(props: HallSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{ fov: 42, position: [0, 20, 20] }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0b0e14']} />
      <CameraFraming {...props} />
      <HallScene {...props} />
    </Canvas>
  )
}

function CameraFraming(props: HallSceneProps) {
  const camera = useThree((s) => s.camera)
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const framedSpan = useRef<number>(-1)
  const b = sceneBounds(props)

  useEffect(() => {
    // reframe ONLY when the room's span meaningfully changes
    if (Math.abs(b.span - framedSpan.current) < 1.0) return
    framedSpan.current = b.span
    const d = b.span * 0.95
    camera.position.set(b.cx + d * 0.55, d * 0.78, b.cy + d * 0.72) // 3/4 iso
    camera.lookAt(b.cx, 0, b.cy)
    controlsRef.current?.target.set(b.cx, 0, b.cy)
  }, [b.span, b.cx, b.cy, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      minDistance={3}
      maxDistance={140}
      // clamped so you can't end up under the floor
      minPolarAngle={Math.PI * (15 / 180)}
      maxPolarAngle={Math.PI * (75 / 180)}
    />
  )
}

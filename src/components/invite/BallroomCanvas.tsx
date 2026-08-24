'use client'

import { useEffect } from 'react'
import { Canvas, invalidate, useThree } from '@react-three/fiber'
import { HallScene, sceneBounds, type HallSceneProps } from '@/lib/scene-builder'

/**
 * The inner Canvas for beat 5's pinned orbit — mounted lazily by
 * `InviteBallroom` via `next/dynamic`. `frameloop="demand"` keeps the GPU
 * idle except when `progress` changes; there's no OrbitControls and no
 * pointer handlers because scroll IS the interaction (the section above
 * sets `pointerEvents: 'none'` here too, so page scroll is never captured).
 */
export default function BallroomCanvas({
  scene,
  progress,
}: {
  scene: HallSceneProps
  progress: number
}) {
  return (
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 50 }} style={{ pointerEvents: 'none' }}>
      <color attach="background" args={['#14100a']} />
      <HallScene {...scene} />
      <OrbitRig scene={scene} progress={progress} />
    </Canvas>
  )
}

/** Positions the camera along a ~170° sweep keyed to scroll progress. */
function OrbitRig({ scene, progress }: { scene: HallSceneProps; progress: number }) {
  const { camera } = useThree()
  const b = sceneBounds(scene)

  useEffect(() => {
    const azimuth = -0.35 * Math.PI + progress * 0.95 * Math.PI
    const r = b.span * 0.85
    camera.position.set(b.cx + r * Math.sin(azimuth), b.span * 0.55, b.cy + r * Math.cos(azimuth))
    camera.lookAt(b.cx, 0, b.cy)
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, b.cx, b.cy, b.span, camera])

  return null
}

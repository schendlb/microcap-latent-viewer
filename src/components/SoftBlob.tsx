import { useRef } from 'react'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

interface Props {
  position: [number, number, number]
  radius: number
  color: string
  opacity: number
  emissiveIntensity?: number
  scale?: number
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}

export function SoftBlob({
  position,
  radius,
  color,
  opacity,
  emissiveIntensity = 0.3,
  scale = 1,
  onPointerOver,
  onPointerOut,
  onClick,
}: Props) {
  const meshRef = useRef<Mesh>(null)

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}

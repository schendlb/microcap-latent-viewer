import { Html } from '@react-three/drei'
import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import { radiusFromVolume, venueColor } from '../lib/data'
import type { TickerState } from '../lib/types'

interface Props {
  state: TickerState
  volumeMax: number
  selected: boolean
  hovered: boolean
  onHover: (ticker: string | null) => void
  onSelect: (ticker: string) => void
}

export function TickerMarker({
  state,
  volumeMax,
  selected,
  hovered,
  onHover,
  onSelect,
}: Props) {
  const meshRef = useRef<Mesh>(null)
  const [localHover, setLocalHover] = useState(false)
  if (!state.visible) return null

  const color = venueColor(state.chain_venue)
  const radius = radiusFromVolume(state.volume_h24, volumeMax)
  const active = selected || hovered || localHover
  const scale = active ? 1.25 : 1

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setLocalHover(true)
    onHover(state.ticker)
    document.body.style.cursor = 'pointer'
  }
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setLocalHover(false)
    onHover(null)
    document.body.style.cursor = 'auto'
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(state.ticker)
  }

  return (
    <group position={state.position}>
      <mesh
        ref={meshRef}
        scale={scale}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.55 : 0.22}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      <Html
        distanceFactor={12}
        position={[0, radius + 0.22, 0]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          transform: 'translate(-50%, -100%)',
        }}
        center
      >
        <div
          style={{
            color: active ? '#fff' : '#c8d0da',
            fontSize: active ? 13 : 11,
            fontWeight: 600,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            textShadow: '0 1px 3px rgba(0,0,0,0.85)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}
        >
          {state.ticker}
        </div>
      </Html>
    </group>
  )
}

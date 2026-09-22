import { Html } from '@react-three/drei'
import { useState, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { radiusFromVolume, venueColor } from '../lib/data'
import type { TickerState } from '../lib/types'
import { SoftBlob } from './SoftBlob'
import { getTemporalColor, getGhostOpacity } from '../lib/colors'

interface Props {
  state: TickerState
  volumeMax: number
  selected: boolean
  hovered: boolean
  onHover: (ticker: string | null) => void
  onSelect: (ticker: string) => void
  ghostStates?: TickerState[]
  futureProjection?: { position: [number, number, number]; confidence: number } | null
}

export function TickerMarker({
  state,
  volumeMax,
  selected,
  hovered,
  onHover,
  onSelect,
  ghostStates = [],
  futureProjection = null,
}: Props) {
  const [localHover, setLocalHover] = useState(false)
  if (!state.visible) return null

  const venueHint = venueColor(state.chain_venue)
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

  // Present state color (temporal position = 0)
  const presentColor = useMemo(() => getTemporalColor(0, venueHint), [venueHint])

  return (
    <>
      {/* Ghost trail: render past states with fading opacity */}
      {ghostStates.map((ghost, idx) => {
        const ghostRadius = radiusFromVolume(ghost.volume_h24, volumeMax) * 0.85
        const opacity = getGhostOpacity(idx, ghostStates.length)
        // Temporal position for ghosts: -1 (oldest) to near 0 (newest)
        const temporalPos = -1 + (idx / Math.max(ghostStates.length - 1, 1))
        const ghostColor = getTemporalColor(temporalPos, venueHint)
        
        return (
          <SoftBlob
            key={`ghost-${ghost.ts_unix}`}
            position={ghost.position}
            radius={ghostRadius}
            color={ghostColor}
            opacity={opacity}
            emissiveIntensity={0.2}
            scale={1}
          />
        )
      })}

      {/* Present state: main interactive blob */}
      <group position={state.position}>
        <SoftBlob
          position={[0, 0, 0]}
          radius={radius}
          color={presentColor}
          opacity={active ? 0.95 : 0.85}
          emissiveIntensity={active ? 0.6 : 0.35}
          scale={scale}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
        
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

      {/* Future projection: show if available */}
      {futureProjection && (
        <SoftBlob
          position={futureProjection.position}
          radius={radius * 0.75}
          color={getTemporalColor(0.7, venueHint)} // Future color
          opacity={0.5 * futureProjection.confidence}
          emissiveIntensity={0.4}
          scale={1}
        />
      )}
    </>
  )
}

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Stars } from '@react-three/drei'
import { useMemo } from 'react'
import { TickerMarker } from './TickerMarker'
import type { TickerState, ProcessedTimeline } from '../lib/types'
import { getGhostStates, getFutureProjection } from '../lib/data'

interface Props {
  states: TickerState[]
  volumeMax: number
  selectedTicker: string | null
  hoveredTicker: string | null
  onHover: (ticker: string | null) => void
  onSelect: (ticker: string | null) => void
  processed: ProcessedTimeline
  currentT: number
}

function AxesHint() {
  return (
    <group>
      {/* Simple axis lines through origin */}
      <mesh>
        <boxGeometry args={[8, 0.01, 0.01]} />
        <meshBasicMaterial color="#334455" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.01, 8, 0.01]} />
        <meshBasicMaterial color="#334455" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.01, 0.01, 8]} />
        <meshBasicMaterial color="#334455" />
      </mesh>
    </group>
  )
}

export function Scene({
  states,
  volumeMax,
  selectedTicker,
  hoveredTicker,
  onHover,
  onSelect,
  processed,
  currentT,
}: Props) {
  // Compute ghost states and future projections for all tickers
  const tickerEnhancements = useMemo(() => {
    const enhancements = new Map<string, {
      ghostStates: TickerState[]
      futureProjection: { position: [number, number, number]; confidence: number } | null
    }>()
    
    for (const state of states) {
      if (!state.visible) continue
      
      const ghostStates = getGhostStates(processed, state.ticker, currentT, 20)
      const futureProjection = getFutureProjection(processed, state.ticker, currentT)
      
      enhancements.set(state.ticker, { ghostStates, futureProjection })
    }
    
    return enhancements
  }, [states, processed, currentT])

  return (
    <Canvas
      camera={{ position: [4.5, 3.2, 5.5], fov: 50, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%', background: '#0b0e13' }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#0b0e13']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 8, 4]} intensity={1.1} />
      <pointLight position={[-4, -2, -3]} intensity={0.35} color="#4a7cff" />
      <Stars radius={60} depth={40} count={1200} factor={2} saturation={0} fade speed={0.4} />
      <AxesHint />
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        sectionSize={2}
        cellColor="#1a2230"
        sectionColor="#243044"
        fadeDistance={28}
        fadeStrength={1.4}
        infiniteGrid
        position={[0, -3.2, 0]}
      />
      {states.map((s) => {
        const enhancements = tickerEnhancements.get(s.ticker)
        return (
          <TickerMarker
            key={s.ticker}
            state={s}
            volumeMax={volumeMax}
            selected={selectedTicker === s.ticker}
            hovered={hoveredTicker === s.ticker}
            onHover={onHover}
            onSelect={(t) => onSelect(t)}
            ghostStates={enhancements?.ghostStates}
            futureProjection={enhancements?.futureProjection}
          />
        )
      })}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={40}
      />
    </Canvas>
  )
}

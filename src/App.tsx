import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Scene } from './components/Scene'
import { InfoPanel } from './components/InfoPanel'
import { TimelineControls } from './components/TimelineControls'
import {
  loadTimeline,
  maxVolume,
  processTimeline,
  statesAtTime,
  VENUE_COLORS,
} from './lib/data'
import type { ProcessedTimeline, TickerState } from './lib/types'
import './App.css'

export default function App() {
  const [processed, setProcessed] = useState<ProcessedTimeline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [currentT, setCurrentT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)

  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const currentRef = useRef(currentT)
  const tMaxRef = useRef(0)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  useEffect(() => {
    currentRef.current = currentT
  }, [currentT])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await loadTimeline()
        const proc = processTimeline(data)
        if (cancelled) return
        setProcessed(proc)
        setCurrentT(proc.tMin)
        tMaxRef.current = proc.tMax
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Playback: advance timeline in real time.
  // speed N means N hours of data per wall-clock second (data is hourly).
  useEffect(() => {
    if (!processed) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (playingRef.current) {
        const advanceSec = dt * speedRef.current * 3600
        let next = currentRef.current + advanceSec
        if (next >= tMaxRef.current) {
          next = tMaxRef.current
          setPlaying(false)
        }
        setCurrentT(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [processed])

  const volumeMax = useMemo(() => (processed ? maxVolume(processed) : 1), [processed])

  const states: TickerState[] = useMemo(() => {
    if (!processed) return []
    return statesAtTime(processed, currentT)
  }, [processed, currentT])

  const focusTicker = hoveredTicker ?? selectedTicker
  const focusState = useMemo(
    () => states.find((s) => s.ticker === focusTicker) ?? null,
    [states, focusTicker],
  )

  const onSelect = useCallback((t: string | null) => setSelectedTicker(t), [])
  const onHover = useCallback((t: string | null) => setHoveredTicker(t), [])

  if (loading) {
    return (
      <div className="app-shell center">
        <div className="loading">Loading timeline & fitting PCA…</div>
      </div>
    )
  }

  if (error || !processed) {
    return (
      <div className="app-shell center">
        <div className="error">Failed to load data: {error ?? 'unknown'}</div>
      </div>
    )
  }

  const varPct = processed.explainedVarianceRatio
    .map((r) => `${(r * 100).toFixed(1)}%`)
    .join(' / ')

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">◎</span>
          <div>
            <div className="brand-title">Microcap Latent Viewer</div>
            <div className="brand-sub">
              3D PCA · {processed.tickers.length} tickers ·{' '}
              {Object.values(processed.samplesByTicker).reduce((a, b) => a + b.length, 0)} samples
            </div>
          </div>
        </div>
        <div className="legend">
          {Object.entries(VENUE_COLORS).map(([venue, color]) => (
            <span key={venue} className="legend-item">
              <span className="swatch" style={{ background: color }} />
              {venue}
            </span>
          ))}
        </div>
        <div className="var-hint mono small">PC1–3 var: {varPct}</div>
      </header>

      <main className="main-stage">
        <Scene
          states={states}
          volumeMax={volumeMax}
          selectedTicker={selectedTicker}
          hoveredTicker={hoveredTicker}
          onHover={onHover}
          onSelect={onSelect}
        />
        <InfoPanel state={focusState} />
      </main>

      <TimelineControls
        tMin={processed.tMin}
        tMax={processed.tMax}
        current={currentT}
        playing={playing}
        speed={speed}
        onChange={setCurrentT}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSpeed={setSpeed}
      />
    </div>
  )
}

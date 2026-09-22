import { formatTs } from '../lib/data'

interface Props {
  tMin: number
  tMax: number
  current: number
  playing: boolean
  speed: number
  onChange: (t: number) => void
  onTogglePlay: () => void
  onSpeed: (s: number) => void
}

const SPEEDS = [1, 2, 5, 10, 30]

export function TimelineControls({
  tMin,
  tMax,
  current,
  playing,
  speed,
  onChange,
  onTogglePlay,
  onSpeed,
}: Props) {
  const span = Math.max(tMax - tMin, 1)
  const pct = ((current - tMin) / span) * 100

  return (
    <div className="panel timeline-panel">
      <div className="timeline-top">
        <button type="button" className="btn" onClick={onTogglePlay} aria-label="Play/Pause">
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="speed-group" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn ghost ${speed === s ? 'active' : ''}`}
              onClick={() => onSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="ts-display mono">{formatTs(current)}</div>
      </div>
      <div className="scrubber-wrap">
        <input
          type="range"
          className="scrubber"
          min={tMin}
          max={tMax}
          step={3600}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(90deg, #4a7cff ${pct}%, #1c2433 ${pct}%)`,
          }}
        />
        <div className="scrubber-ends mono small">
          <span>{formatTs(tMin)}</span>
          <span>{formatTs(tMax)}</span>
        </div>
      </div>
    </div>
  )
}

import { fitPca } from './pca'
import type {
  ProcessedTimeline,
  TimelineData,
  TimelineRow,
  TickerSample,
  TickerState,
} from './types'

/** Canonical feature order for aligned vectors. */
export const FEATURE_NAMES = [
  'price_usd',
  'volume_h1',
  'volume_h6',
  'volume_h24',
  'price_change_h1',
  'price_change_h6',
  'price_change_h24',
  'volatility_24h',
  'range_pct',
] as const

export function alignFeatures(row: TimelineRow, featureNames: readonly string[]): number[] {
  const map = new Map<string, number>()
  for (let i = 0; i < row.feature_names.length; i++) {
    map.set(row.feature_names[i], row.feature_vector[i])
  }
  return featureNames.map((name) => {
    const v = map.get(name)
    return v !== undefined && Number.isFinite(v) ? v : Number.NaN
  })
}

export async function loadTimeline(url = '/data/frontend_timeline.json'): Promise<TimelineData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load timeline: ${res.status}`)
  return (await res.json()) as TimelineData
}

export function processTimeline(data: TimelineData): ProcessedTimeline {
  const featureNames = [...FEATURE_NAMES]
  const rows = [...data.rows].sort((a, b) => a.ts_unix - b.ts_unix || a.ticker.localeCompare(b.ticker))

  const aligned = rows.map((r) => alignFeatures(r, featureNames))
  const pca = fitPca(aligned, 3)

  const samplesByTicker: Record<string, TickerSample[]> = {}
  const tickers = data.tickers?.length
    ? [...data.tickers]
    : [...new Set(rows.map((r) => r.ticker))]

  for (const t of tickers) samplesByTicker[t] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const score = pca.scores[i] ?? [0, 0, 0]
    const sample: TickerSample = {
      ticker: r.ticker,
      chain_venue: r.chain_venue,
      ts_unix: r.ts_unix,
      ts_iso: r.ts_iso,
      price_usd: r.price_usd ?? null,
      volume_h24: r.volume_h24 ?? null,
      r_1d: r.r_1d ?? null,
      r_3d: r.r_3d ?? null,
      xyz: [score[0] ?? 0, score[1] ?? 0, score[2] ?? 0],
      featureAligned: aligned[i],
    }
    if (!samplesByTicker[r.ticker]) samplesByTicker[r.ticker] = []
    samplesByTicker[r.ticker].push(sample)
  }

  // Ensure each ticker's samples are sorted
  for (const t of Object.keys(samplesByTicker)) {
    samplesByTicker[t].sort((a, b) => a.ts_unix - b.ts_unix)
  }

  const tsSet = new Set<number>()
  for (const r of rows) tsSet.add(r.ts_unix)
  const timestamps = [...tsSet].sort((a, b) => a - b)

  const tMin = timestamps[0] ?? 0
  const tMax = timestamps[timestamps.length - 1] ?? 0

  return {
    featureNames,
    tickers,
    samplesByTicker,
    timestamps,
    means: pca.means,
    stds: pca.stds,
    components: pca.components,
    explainedVarianceRatio: pca.explainedVarianceRatio,
    tMin,
    tMax,
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVec(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/**
 * At time t, for each ticker: find surrounding samples, use latest with ts<=t,
 * and lerp position toward the next sample when between timestamps.
 */
export function statesAtTime(processed: ProcessedTimeline, t: number): TickerState[] {
  const states: TickerState[] = []

  for (const ticker of processed.tickers) {
    const samples = processed.samplesByTicker[ticker] ?? []
    if (samples.length === 0) continue

    // First sample after/at start
    if (t < samples[0].ts_unix) {
      // Not yet visible — optionally show at first sample faded; we hide
      states.push({
        ticker,
        chain_venue: samples[0].chain_venue,
        position: samples[0].xyz,
        price_usd: samples[0].price_usd,
        volume_h24: samples[0].volume_h24,
        r_1d: samples[0].r_1d,
        r_3d: samples[0].r_3d,
        ts_unix: samples[0].ts_unix,
        ts_iso: samples[0].ts_iso,
        visible: false,
      })
      continue
    }

    // Binary search for rightmost sample with ts <= t
    let lo = 0
    let hi = samples.length - 1
    let idx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (samples[mid].ts_unix <= t) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    const cur = samples[idx]
    const next = samples[idx + 1]
    let position = cur.xyz

    if (next && next.ts_unix > cur.ts_unix) {
      const span = next.ts_unix - cur.ts_unix
      const alpha = Math.min(1, Math.max(0, (t - cur.ts_unix) / span))
      position = lerpVec(cur.xyz, next.xyz, alpha)
    }

    states.push({
      ticker,
      chain_venue: cur.chain_venue,
      position,
      price_usd: cur.price_usd,
      volume_h24: cur.volume_h24,
      r_1d: cur.r_1d,
      r_3d: cur.r_3d,
      ts_unix: cur.ts_unix,
      ts_iso: cur.ts_iso,
      visible: true,
    })
  }

  return states
}

export const VENUE_COLORS: Record<string, string> = {
  base: '#3ecf8e',
  robinhood: '#ff6b2c',
}

export function venueColor(venue: string): string {
  const key = venue.toLowerCase()
  return VENUE_COLORS[key] ?? '#8899aa'
}

/** Map volume_h24 to a sphere radius in scene units. */
export function radiusFromVolume(volume: number | null | undefined, globalMax: number): number {
  const base = 0.35 // Increased from 0.18 for better visibility
  if (volume == null || !Number.isFinite(volume) || globalMax <= 0) return base
  const norm = Math.sqrt(Math.max(volume, 0) / globalMax) // sqrt dampens outliers
  return base + norm * 0.65 // Increased from 0.45
}

export function maxVolume(processed: ProcessedTimeline): number {
  let m = 0
  for (const samples of Object.values(processed.samplesByTicker)) {
    for (const s of samples) {
      if (s.volume_h24 != null && s.volume_h24 > m) m = s.volume_h24
    }
  }
  return m || 1
}

export function formatTs(tsUnix: number): string {
  try {
    return new Date(tsUnix * 1000).toLocaleString('en-GB', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' CET/CEST'
  } catch {
    return String(tsUnix)
  }
}

export function formatPrice(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'
  if (p === 0) return '0'
  if (p < 0.01) return p.toExponential(3)
  return p.toPrecision(4)
}

export function formatPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(2)}%`
}

/**
 * Get historical states for ghost trail (up to maxSteps prior timestamps).
 * Returns array of states from oldest to newest (excluding current time).
 */
export function getGhostStates(
  processed: ProcessedTimeline,
  ticker: string,
  currentT: number,
  maxSteps = 20,
): TickerState[] {
  const samples = processed.samplesByTicker[ticker] ?? []
  if (samples.length === 0) return []

  // Find current sample index
  let currentIdx = -1
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].ts_unix <= currentT) {
      currentIdx = i
    } else {
      break
    }
  }

  if (currentIdx < 0) return []

  // Get up to maxSteps prior samples
  const startIdx = Math.max(0, currentIdx - maxSteps + 1)
  const ghosts: TickerState[] = []

  for (let i = startIdx; i < currentIdx; i++) {
    const sample = samples[i]
    ghosts.push({
      ticker,
      chain_venue: sample.chain_venue,
      position: sample.xyz,
      price_usd: sample.price_usd,
      volume_h24: sample.volume_h24,
      r_1d: sample.r_1d,
      r_3d: sample.r_3d,
      ts_unix: sample.ts_unix,
      ts_iso: sample.ts_iso,
      visible: true,
    })
  }

  return ghosts
}

/**
 * Project future position using velocity extrapolation and/or r_1d/r_3d labels.
 * Uses last 3-5 samples for velocity estimation when available.
 */
export function getFutureProjection(
  processed: ProcessedTimeline,
  ticker: string,
  currentT: number,
  horizonSeconds = 3600 * 6, // 6 hours ahead by default
): { position: [number, number, number]; confidence: number } | null {
  const samples = processed.samplesByTicker[ticker] ?? []
  if (samples.length === 0) return null

  // Find current sample index
  let currentIdx = -1
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].ts_unix <= currentT) {
      currentIdx = i
    } else {
      break
    }
  }

  if (currentIdx < 0) return null

  const current = samples[currentIdx]
  
  // Method 1: Velocity extrapolation from last few samples
  const lookback = Math.min(5, currentIdx + 1)
  if (lookback >= 2) {
    const recent = samples.slice(currentIdx - lookback + 1, currentIdx + 1)
    
    // Compute average velocity in PCA space
    let vx = 0, vy = 0, vz = 0
    let count = 0
    
    for (let i = 1; i < recent.length; i++) {
      const dt = recent[i].ts_unix - recent[i - 1].ts_unix
      if (dt > 0) {
        vx += (recent[i].xyz[0] - recent[i - 1].xyz[0]) / dt
        vy += (recent[i].xyz[1] - recent[i - 1].xyz[1]) / dt
        vz += (recent[i].xyz[2] - recent[i - 1].xyz[2]) / dt
        count++
      }
    }
    
    if (count > 0) {
      vx /= count
      vy /= count
      vz /= count
      
      // Method 2: Incorporate r_1d/r_3d if available as a nudge
      // r_1d/r_3d are price returns; we can use them to bias the velocity
      let nudgeFactor = 1.0
      if (current.r_1d != null && Number.isFinite(current.r_1d)) {
        // Small nudge based on momentum (r_1d is in %, convert to factor)
        nudgeFactor += current.r_1d * 0.005 // subtle influence
      }
      
      const projectedPos: [number, number, number] = [
        current.xyz[0] + vx * horizonSeconds * nudgeFactor,
        current.xyz[1] + vy * horizonSeconds * nudgeFactor,
        current.xyz[2] + vz * horizonSeconds * nudgeFactor,
      ]
      
      // Confidence based on velocity consistency
      const velocityMag = Math.sqrt(vx * vx + vy * vy + vz * vz)
      const confidence = Math.min(1.0, 0.3 + velocityMag * 2) // Higher velocity = more confident
      
      return { position: projectedPos, confidence }
    }
  }
  
  // Fallback: just use r_1d/r_3d as a directional hint
  if (current.r_1d != null && Number.isFinite(current.r_1d)) {
    const magnitude = Math.abs(current.r_1d) * 0.15
    const direction = current.r_1d > 0 ? 1 : -1
    
    return {
      position: [
        current.xyz[0] + direction * magnitude * 0.7,
        current.xyz[1] + direction * magnitude * 0.5,
        current.xyz[2] + direction * magnitude * 0.3,
      ],
      confidence: 0.3,
    }
  }
  
  return null
}

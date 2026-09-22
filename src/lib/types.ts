export type ChainVenue = 'base' | 'robinhood' | string

export interface TimelineRow {
  ticker: string
  chain_venue: ChainVenue
  ts_unix: number
  ts_iso: string
  feature_names: string[]
  feature_vector: number[]
  price_usd?: number
  volume_h24?: number
  r_1d?: number
  r_3d?: number
  y?: number[]
}

export interface TimelineData {
  generated_at?: string
  description?: string
  tickers: string[]
  n_rows: number
  rows: TimelineRow[]
}

export interface TickerSample {
  ticker: string
  chain_venue: ChainVenue
  ts_unix: number
  ts_iso: string
  price_usd: number | null
  volume_h24: number | null
  r_1d: number | null
  r_3d: number | null
  /** PCA coordinates in fitted 3D space */
  xyz: [number, number, number]
  featureAligned: number[]
}

export interface ProcessedTimeline {
  featureNames: string[]
  tickers: string[]
  samplesByTicker: Record<string, TickerSample[]>
  /** Sorted unique timestamps across all samples */
  timestamps: number[]
  /** Global PCA fit metadata */
  means: number[]
  stds: number[]
  components: number[][] // 3 x d
  explainedVarianceRatio: number[]
  tMin: number
  tMax: number
}

export interface TickerState {
  ticker: string
  chain_venue: ChainVenue
  position: [number, number, number]
  price_usd: number | null
  volume_h24: number | null
  r_1d: number | null
  r_3d: number | null
  ts_unix: number
  ts_iso: string
  visible: boolean
}

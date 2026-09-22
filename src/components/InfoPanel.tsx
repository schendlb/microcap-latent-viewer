import { formatPct, formatPrice, venueColor } from '../lib/data'
import type { TickerState } from '../lib/types'

interface Props {
  state: TickerState | null
}

export function InfoPanel({ state }: Props) {
  if (!state) {
    return (
      <aside className="panel info-panel muted">
        <div className="panel-title">Selection</div>
        <p>Hover or click a ticker sphere.</p>
      </aside>
    )
  }

  const color = venueColor(state.chain_venue)

  return (
    <aside className="panel info-panel">
      <div className="panel-title" style={{ color }}>
        {state.ticker}
      </div>
      <dl className="kv">
        <div>
          <dt>Venue</dt>
          <dd>
            <span className="chip" style={{ borderColor: color, color }}>
              {state.chain_venue}
            </span>
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatPrice(state.price_usd)}</dd>
        </div>
        <div>
          <dt>Vol 24h</dt>
          <dd>
            {state.volume_h24 != null && Number.isFinite(state.volume_h24)
              ? state.volume_h24.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '—'}
          </dd>
        </div>
        <div>
          <dt>r_1d</dt>
          <dd className={retClass(state.r_1d)}>{formatPct(state.r_1d)}</dd>
        </div>
        <div>
          <dt>r_3d</dt>
          <dd className={retClass(state.r_3d)}>{formatPct(state.r_3d)}</dd>
        </div>
        <div>
          <dt>Sample ts</dt>
          <dd className="mono small">{state.ts_iso}</dd>
        </div>
        <div>
          <dt>PCA xyz</dt>
          <dd className="mono small">
            {state.position.map((v) => v.toFixed(2)).join(', ')}
          </dd>
        </div>
      </dl>
    </aside>
  )
}

function retClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return ''
  if (v > 0) return 'pos'
  if (v < 0) return 'neg'
  return ''
}

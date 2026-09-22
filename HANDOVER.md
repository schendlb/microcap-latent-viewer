# Ultra Micro-Cap Latent Tracker — Handover Document

**Audience:** another LLM (or engineer) picking up this project cold.  
**Owner GitHub:** `schendlb`  
**Timezone for schedules / logs:** Europe/Amsterdam (CEST/CET)  
**Handover written:** 2026-09-22 (CEST)

This document covers **goals and intention**, then **what has been built**, **how to operate it**, **secrets/cost constraints**, and **open work**. Do not invent data or metrics; prefer reading the listed files.

---

## 1. Goals and intention (why this exists)

### Product goal
Build a working analysis system for a small book of **ultra micro-cap tokens** spanning **Robinhood Chain** and **Base** (max **20** names; currently **6 seeds**).

The user does **not** want a vanity dashboard. They want a system that:

1. Represents each token as **vectors in latent spaces** (LLM-like embedding intuition), not only a scalar “heat” score.
2. Maintains at least two spaces:
   - **Market latent space** — price, volume, mcap/liquidity, txns, returns windows, etc.
   - **Social latent space** — X / Telegram / Farcaster attention (+ narrative later).
3. Makes a **prediction** of an **outcome vector**.
4. Defines **“working” continuously**, not binary: after the horizon, compare predicted vs realized outcome (e.g. cosine / angle / magnitude). Paths that land in the right direction get **reinforced**.

### Locked outcome definition
\[
y = [r_{1d},\ r_{3d}]
\]
percent price change from snapshot time to **+1 day** and **+3 days**.

Horizon of interest for “breakout / narrative shift” thinking: **1–3 days** (daily grain).

### Locked v1 product priorities (evolved)
Originally: early heat/breakout ranking + narrative shift detection; latent vectors deferred.  
User then reframed: **dual latent spaces + continuous directional reinforcement** are the real product; scalar heat was a temporary toy.

Output ranking style when ranking is shown: **one combined book** with a **chain/venue tag** (`Base` / `Robinhood`), not two separate rankings.

### Visualization goal
A **3D latent-space timeline** (React Three Fiber) where tokens move through PCA space over historical (then live) time; past ghosts, present, and projected future should be readable on a **color spectrum**; soft volumetric / SDF-like blobs preferred over hard spheres because values are **probabilistic**.

---

## 2. Universe (seeds)

Hard cap: **20** names. Current seed book (`/workspace/microcap-tracker/seed_book.json`):

| Ticker | Venue | Address | X | Telegram |
|--------|-------|---------|---|----------|
| IPOWN | Robinhood | `0x91D57257304Ed09a72a4e76E3C97c25bC185E59c` | `@IPOwn_Stock` | `t.me/ipownstock` |
| BRAINARM | Base | `0xB2000000000000000000005A0c125DA6CF531D01` | `@xbrainarmstrong` | `t.me/brainarmstrong_base` |
| SINGIT | Base | `0xc2c1e0b7C401e6217193732272444D928646eba3` | `@SingItAgent` | `t.me/SingItAgents` |
| Harness | Base | `0xD3E592E728AE3461BD97c7A6B359E1043dd83bA3` | `@tryharness` | — |
| FRONT | Robinhood | `0xed8E00E32cf7F4026A66e991BDb769d196c82c83` | `@FrontierRWA` | — |
| HUBRIS | Robinhood | `0xb27339261475ef2724095F166B46E34223B13489` | `@hubris_rh` | — |

**Important:** Do **not** assume Base for every address. FRONT here is **not** legacy Ethereum FRONT. IPOWN/FRONT/HUBRIS trade on DexScreener `chainId: "robinhood"`. Codex network id for Robinhood Chain = **4663**.

---

## 3. Repository and deployment layout

### A. Data + collectors (box-local, not necessarily on GitHub)
Root: `/workspace/microcap-tracker/`

| Path | Role |
|------|------|
| `seed_book.json` / `.csv` | Canonical universe + social handles |
| `scripts/log_market_features.py` | Live DexScreener market feature logger |
| `scripts/label_forward_returns.py` | Attach `r_1d`/`r_3d` when later snaps exist |
| `scripts/log_social_features.py` | Social logger (X/TG/FC) with cost guards |
| `scripts/fetch_gmgn_ohlcv.py` | Base history via gmgn public kline |
| `scripts/fetch_codex_ohlcv.py` | Robinhood (+ other) OHLCV via Codex GraphQL |
| `scripts/build_historical_dataset.py` | Build labeled historical feature JSONL + ridge baseline |
| `scripts/backfill_historical_ohlcv.py` / `fetch_gt_base_ohlcv.py` | Earlier GeckoTerminal attempts (rate-limit painful) |
| `data/market_features.jsonl` | Live market feature log |
| `data/latest_features.json` | Latest market snapshot |
| `data/labeled_outcomes.jsonl` | Forward-return labels joined by snapshot_id |
| `data/social_features.jsonl` / `latest_social_features.json` | Social snaps |
| `data/social_handles.json` | Handle map |
| `data/historical/*.json` | Per-ticker OHLCV dumps |
| `data/historical_market_features.jsonl` | ~1821 labeled/feature hourly rows (historical) |
| `data/historical_baseline_metrics.json` | Ridge baseline “working” scores |
| `data/frontend_timeline.json` | Compact export consumed by the 3D viewer |
| `schema/*.md` + `*_feature_names.json` | Schemas |

### B. Frontend (GitHub + Vercel)
| Item | Value |
|------|--------|
| Repo | https://github.com/schendlb/microcap-latent-viewer |
| Live | https://microcap-latent-viewer.vercel.app |
| Stack | Vite, React, TypeScript, three, `@react-three/fiber`, `@react-three/drei` |
| Local checkout | `/workspace/microcap-latent-viewer` |
| Data file in app | `public/data/frontend_timeline.json` |

Auto-deploy: Vercel project linked to the GitHub repo (`barnabas-schendls-projects/microcap-latent-viewer`). Push to `main` redeploys.

---

## 4. Conceptual architecture

```
                    ┌─────────────────────────┐
  DexScreener /     │  Market feature vector  │──► JSONL log
  Codex / gmgn  ──► │  (12-dim live schema)   │──► historical JSONL
                    └───────────┬─────────────┘
                                │ join on time+ticker
                    ┌───────────▼─────────────┐
  X / TG / FC   ──► │  Social feature vector  │──► social JSONL
                    │  (18-dim; many nulls)   │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Predict ŷ = [r1d,r3d]  │  (baseline: ridge on market only so far)
                    └───────────┬─────────────┘
                                │ after +1d/+3d
                    ┌───────────▼─────────────┐
                    │ Score: cosine(ŷ, y) etc │  continuous “working”
                    └─────────────────────────┘

  Historical market features ──► z-score + PCA(3) ──► R3F 3D timeline viewer
```

### Early scalar heat (legacy toy)
`heat_snapshot_*.json` / `.md` used a DexScreener-only heat:
`0.40*turnover + 0.30*momentum + 0.30*activity` × liquidity multiplier.  
**Deferred** once latent + outcome framing locked; do not treat as the product north star.

---

## 5. Market pipeline (technical)

### Live logger
- Script: `python3 /workspace/microcap-tracker/scripts/log_market_features.py`
- Source: DexScreener `https://api.dexscreener.com/latest/dex/tokens/<address>`
- Primary pair: highest `liquidity.usd` on matching `chainId` (`base` | `robinhood`)
- Feature order (see `schema/feature_names.json`):  
  `price_usd, market_cap, liquidity_usd, volume_h1, volume_h6, volume_h24, txns_h24_buys, txns_h24_sells, txns_h24, price_change_h1, price_change_h6, price_change_h24`
- Labeler: `label_forward_returns.py` writes `data/labeled_outcomes.jsonl` when later snaps ≈ +1d/+3d exist (does not mutate historical feature rows)

### Grok Bot routines (schedules in Europe/Amsterdam)
| Routine | Schedule | Behavior |
|---------|----------|----------|
| Market feature logger | Weekdays 08:00, 12:00, 16:00, 20:00 | Run market logger + labeler; **stay quiet** unless new `r_1d`/`r_3d` labels land or repeated auth failures |
| Social feature logger | Weekdays 09:00 | Social logger with **X disabled**; quiet |
| Retrain microcap baseline | Fridays 09:00 | Re-label, assess labeled count, retrain ridge if thick enough; report honest go/no-go vs early smoke tests |

### Historical backfill sources (lessons learned)
| Source | Base | Robinhood | Notes |
|--------|------|-----------|-------|
| GeckoTerminal | Yes (rate limits / 429) | No network | Early BRAINARM ~178×1h |
| gmgn.ai public kline | Yes (SINGIT/Harness 504×1h) | Public kline: network not supported | No auth for public path |
| DexScreener | Live pairs | Live pairs | **No historical OHLCV** on public API |
| Codex (`graph.codex.io`) | Supported | **4663 supported** | Needs API key; unlocked FRONT/HUBRIS history; IPOWN too short for `r_3d` at first pull |

Defined.fi UI ≈ Codex GraphQL API (same company). Key is a **Codex** API key, not a separate “defined.fi-only” key.

### Baseline “working” scores (as of last rebuild)
File: `data/historical_baseline_metrics.json`  
- Model: ridge on z-scored features, time-based 70/30 split  
- After Base gmgn + Robinhood Codex: **~1821 labeled** rows; mean cosine pred vs `[r_1d,r_3d]` ≈ **0.08** (earlier BRAINARM-only smoke was ~0.45; larger set made naive ridge look worse — expected).  
- This is **not** a working latent predictor yet; pipeline exists, model is weak.

---

## 6. Social pipeline (technical)

### Schema
`schema/social_features.md` + `social_feature_names.json`  
Join key: `ticker` + `hour_bucket` (`ts_unix - ts_unix % 3600`).

### Sources
- **X:** Twitter API v2 recent search. Requires `X_BEARER_TOKEN` (OAuth 2.0 App-Only).  
- **Telegram:** public channel preview OK; groups often member count only.  
- **Farcaster:** Warpcast search free; few/no verified FC handles for seeds yet.

### Cost control (critical)
User topped up **~$5** on X; first cold social snap cost **~$2.48** (~494 billable events — X bills by **returned posts**, not “checks”).

Guards in `log_social_features.py`:
- `X_ENABLE` defaults to **0** (off)
- `X_MAX_RESULTS` defaults to **10**
- Weekly soft budget file: `~/.config/microcap/x_budget.json`
- **`since_id` incremental pulls:** watermarks in `~/.config/microcap/x_since_ids.json` for all six tickers after a cheap cold pass (+~60 events). Next X pulls should only bill **new** posts.

**Policy:** Do **not** call X unless the user explicitly asks. Scheduled social runs are TG/FC only.

Secrets on box (never commit / never echo):
- `~/.config/microcap/x_bearer_token` (+ env `X_BEARER_TOKEN`)
- `~/.config/microcap/codex_api_key` (+ env `CODEX_API_KEY`)

---

## 7. Frontend (technical)

### What it does
1. Loads `frontend_timeline.json` (~1821 hourly samples).
2. Aligns feature dims → **z-score** → **PCA to 3 components** (`src/lib/pca.ts`, Jacobi eigendecomp).
3. Scrubber + play/pause + speed: at time `t`, place each ticker at PCA of latest sample with `ts ≤ t` (lerp between samples).
4. **Ghost trail:** up to **20** prior steps, fading opacity (`getGhostStates`).
5. **Future projection:** short PCA velocity extrapolation (+ optional `r_1d` nudge); UI labels as **not ground truth**.
6. **Temporal color spectrum:** past (cool blue) → present (cyan) → future (warm orange) in `src/lib/colors.ts`.
7. **SoftBlob** volumes (translucent/emissive soft spheres) instead of hard opaque spheres — **not** full raymarched SDF yet (hover reliability trade-off). Venue remains a secondary cue.

### Key source files
- `src/App.tsx` — shell / legend
- `src/components/Scene.tsx` — Canvas, ghosts + futures wiring
- `src/components/TickerMarker.tsx` / `SoftBlob.tsx`
- `src/components/TimelineControls.tsx` / `InfoPanel.tsx`
- `src/lib/data.ts` — load, PCA apply, ghosts, future projection
- `src/lib/pca.ts`, `colors.ts`, `types.ts`

### Local run
```bash
cd /workspace/microcap-latent-viewer
npm install
npm run dev -- --host 0.0.0.0 --port 5173
# http://127.0.0.1:5173/
```

### Refreshing viewer data from collectors
Rebuild/export timeline from historical features (see `frontend_timeline.json` generator used previously), copy into `public/data/frontend_timeline.json`, commit + push to trigger Vercel.

---

## 8. Operator cheatsheet

```bash
# Live market snap
python3 /workspace/microcap-tracker/scripts/log_market_features.py
python3 /workspace/microcap-tracker/scripts/label_forward_returns.py

# Social snap WITHOUT spending X
X_ENABLE=0 python3 /workspace/microcap-tracker/scripts/log_social_features.py

# Social snap WITH cheap incremental X (only if user asked)
export X_BEARER_TOKEN="$(cat /home/box/.config/microcap/x_bearer_token)"
X_ENABLE=1 X_MAX_RESULTS=10 python3 /workspace/microcap-tracker/scripts/log_social_features.py

# Robinhood/Base OHLCV via Codex
export CODEX_API_KEY="$(cat /home/box/.config/microcap/codex_api_key)"
python3 /workspace/microcap-tracker/scripts/fetch_codex_ohlcv.py
# then rebuild historical dataset / baseline as documented in scripts + README
```

GitHub CLI on the box is authenticated as **`schendlb`**.

---

## 9. What “done” / “working” means here

| Layer | Status |
|-------|--------|
| Seed universe + venue tagging | Done (6/20) |
| Live market logging + weekday routine | Done |
| Historical market features + labels | Partially done (~1821 rows; IPOWN history thin) |
| Live social logging | Scaffolded; X gated for cost; TG/FC sparse |
| Joint social+market → ŷ predictor with reinforcement loop | **Not built** (ridge on market only; weak cosine) |
| Narrative shift labels as first-class track | Designed earlier; not productized |
| 3D PCA timeline viewer + deploy | Done (ghosts/future/spectrum/soft blobs) |
| True raymarched SDF density fields | Open |
| Live viewer fed by ongoing snaps automatically | Open (static JSON export today) |

---

## 10. Open / next work (suggested order)

1. **Accumulate live market labels** until Friday retrain has enough rows; improve predictor beyond ridge (still score with continuous cosine on `[r_1d,r_3d]`).
2. **Wire social vectors into the same training join** once X can be sampled cheaply via `since_id` (only with budget).
3. **Auto-refresh `frontend_timeline.json`** from live+historical logs and redeploy viewer.
4. **True SDF / density field rendering** if user still wants probabilistic volumes beyond SoftBlob.
5. Expand universe toward 20 names with the same seed schema.
6. Tighten noisy X queries (especially `$FRONT`).

---

## 11. Constraints and non-goals

- Do **not** fabricate OHLCV, engagement, or labels.
- Do **not** spend X API without explicit user ask; respect weekly budget ledger.
- Do **not** commit secrets (`.env.local`, `~/.config/microcap/*` keys, Vercel OIDC tokens).
- Not financial advice; microcaps are extremely noisy / illiquid.
- Scalar heat ranking is legacy; latent + continuous reinforcement is the north star.

---

## 12. Quick links

- Viewer (prod): https://microcap-latent-viewer.vercel.app  
- Viewer repo: https://github.com/schendlb/microcap-latent-viewer  
- Tracker root (box): `/workspace/microcap-tracker`  
- This handover: `/workspace/microcap-tracker/HANDOVER.md` (and copy in viewer repo if pushed)

---

*End of handover. Prefer reading the listed JSON/JSONL/schema files over guessing field names.*

# Microcap Latent Viewer

3D PCA latent-space viewer for ultra micro-cap tokens, built with Vite, React, TypeScript, and React Three Fiber.

Each ticker is rendered as a soft volumetric blob in a fitted 3-component PCA space over hourly market feature vectors. A timeline scrubber (with play/pause and speed) moves through time; positions use the latest sample at or before `t` and lerp between consecutive samples.

## Features

### Ghosted Past Trail
Each ticker shows up to **20 historical positions** as fading ghost blobs. Older positions are more transparent (cool blue tones), fading in toward the present (bright cyan). This gives a sense of recent trajectory through the latent space.

### Projected Future Position
A **future marker** (warm orange) shows where each ticker might move next, based on:
- Short-horizon velocity extrapolation from the last 3-5 PCA samples
- Optional momentum nudge using `r_1d` (1-day return) when available

**Note:** Future projections are **not ground truth**—they're simple extrapolations for visualization purposes only. Confidence varies with recent velocity consistency.

### Temporal Color Spectrum
Colors encode time:
- **Past** (ghosts): Cool blues → cyan (oldest to newest)
- **Present**: Bright cyan/white (peak clarity at scrubber position)
- **Future**: Warm orange (projected position)

Venue colors (Base green, Robinhood orange) are blended in subtly as a secondary cue.

### Soft Glowing Volumes
Instead of hard spheres, tickers are rendered as **soft glowing blobs** using high-quality sphere geometry with emissive materials, transparency, and smooth shading. This gives a "probability cloud" aesthetic with soft edges and volumetric glow, suitable for the probabilistic nature of the PCA embedding.

**Note**: An initial custom SDF shader implementation was replaced with enhanced standard materials to ensure reliable pointer interaction and performance while maintaining the soft, glowing volumetric appearance.

## Data

Timeline JSON is served from:

```
public/data/frontend_timeline.json
```

Copied from `microcap-tracker/data/frontend_timeline.json`. Do not invent rows or call external APIs from this app.

## Setup

```bash
npm install
```

## Develop

```bash
npm run dev
# or bind all interfaces:
npm run dev -- --host 0.0.0.0 --port 5173
```

Open http://localhost:5173

## Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Stack

- Vite + React 19 + TypeScript
- `three`, `@react-three/fiber`, `@react-three/drei`
- In-app z-score + PCA (Jacobi eigendecomposition of the covariance matrix) — no heavy ML libraries

## UI

- **OrbitControls** — drag to orbit, scroll to zoom
- **Click / hover** — info panel shows ticker, venue, price, `r_1d` / `r_3d`
- **Legend** — Base (green) vs Robinhood (orange)
- **Timeline** — scrubber, play/pause, speed multipliers (hours of data per wall-clock second)

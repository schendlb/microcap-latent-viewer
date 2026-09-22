# Microcap Latent Viewer

3D PCA latent-space viewer for ultra micro-cap tokens, built with Vite, React, TypeScript, and React Three Fiber.

Each ticker is a sphere in a fitted 3-component PCA space over hourly market feature vectors. A timeline scrubber (with play/pause and speed) moves through time; positions use the latest sample at or before `t` and lerp between consecutive samples.

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

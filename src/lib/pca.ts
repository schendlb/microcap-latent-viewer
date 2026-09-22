/**
 * Lightweight z-score + PCA via Jacobi eigendecomposition of the covariance matrix.
 * No heavy ML dependencies — suitable for small feature dims (d ≈ 9).
 */

/** Column means of matrix rows (n x d). */
export function columnMeans(rows: number[][]): number[] {
  const n = rows.length
  const d = rows[0]?.length ?? 0
  const means = new Array(d).fill(0)
  for (const row of rows) {
    for (let j = 0; j < d; j++) means[j] += row[j]
  }
  for (let j = 0; j < d; j++) means[j] /= Math.max(n, 1)
  return means
}

/** Population-style std (ddof=0) with floor to avoid div-by-zero. */
export function columnStds(rows: number[][], means: number[]): number[] {
  const n = rows.length
  const d = means.length
  const vars = new Array(d).fill(0)
  for (const row of rows) {
    for (let j = 0; j < d; j++) {
      const diff = row[j] - means[j]
      vars[j] += diff * diff
    }
  }
  return vars.map((v) => Math.max(Math.sqrt(v / Math.max(n, 1)), 1e-12))
}

export function zScoreRows(rows: number[][], means: number[], stds: number[]): number[][] {
  return rows.map((row) => row.map((v, j) => (v - means[j]) / stds[j]))
}

/** Symmetric Jacobi eigenvalue decomposition for small d x d matrices. */
function jacobiEigen(A: number[][], maxIter = 100): { values: number[]; vectors: number[][] } {
  const d = A.length
  // Clone
  const a = A.map((r) => r.slice())
  // Identity eigenvectors
  const v = Array.from({ length: d }, (_, i) => {
    const row = new Array(d).fill(0)
    row[i] = 1
    return row
  })

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal
    let p = 0
    let q = 1
    let max = 0
    for (let i = 0; i < d; i++) {
      for (let j = i + 1; j < d; j++) {
        const abs = Math.abs(a[i][j])
        if (abs > max) {
          max = abs
          p = i
          q = j
        }
      }
    }
    if (max < 1e-12) break

    const app = a[p][p]
    const aqq = a[q][q]
    const apq = a[p][q]
    const theta = 0.5 * Math.atan2(2 * apq, aqq - app)
    const c = Math.cos(theta)
    const s = Math.sin(theta)

    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq
    a[p][q] = 0
    a[q][p] = 0

    for (let i = 0; i < d; i++) {
      if (i === p || i === q) continue
      const aip = a[i][p]
      const aiq = a[i][q]
      a[i][p] = c * aip - s * aiq
      a[p][i] = a[i][p]
      a[i][q] = s * aip + c * aiq
      a[q][i] = a[i][q]
    }

    for (let i = 0; i < d; i++) {
      const vip = v[i][p]
      const viq = v[i][q]
      v[i][p] = c * vip - s * viq
      v[i][q] = s * vip + c * viq
    }
  }

  const values = a.map((row, i) => row[i])
  // Sort descending by eigenvalue; reorder eigenvector columns
  const order = values
    .map((val, i) => ({ val, i }))
    .sort((x, y) => y.val - x.val)
    .map((o) => o.i)

  const sortedValues = order.map((i) => values[i])
  const sortedVectors = Array.from({ length: d }, (_, r) => order.map((c) => v[r][c]))

  return { values: sortedValues, vectors: sortedVectors }
}

export interface PcaResult {
  means: number[]
  stds: number[]
  /** Principal axes: k x d (rows are components) */
  components: number[][]
  explainedVariance: number[]
  explainedVarianceRatio: number[]
  /** Projected scores: n x k */
  scores: number[][]
}

/**
 * Fit PCA to `k` components on raw feature rows.
 * Pipeline: mean-impute NaNs → z-score → cov eigendecomp → project.
 */
export function fitPca(rows: number[][], k = 3): PcaResult {
  if (rows.length === 0) {
    return {
      means: [],
      stds: [],
      components: [],
      explainedVariance: [],
      explainedVarianceRatio: [],
      scores: [],
    }
  }
  const d = rows[0].length
  const n = rows.length

  // Mean-impute NaN / null-ish
  const colSums = new Array(d).fill(0)
  const colCounts = new Array(d).fill(0)
  for (const row of rows) {
    for (let j = 0; j < d; j++) {
      const v = row[j]
      if (Number.isFinite(v)) {
        colSums[j] += v
        colCounts[j]++
      }
    }
  }
  const imputeMeans = colSums.map((s, j) => (colCounts[j] > 0 ? s / colCounts[j] : 0))
  const imputed = rows.map((row) =>
    row.map((v, j) => (Number.isFinite(v) ? v : imputeMeans[j])),
  )

  const means = columnMeans(imputed)
  const stds = columnStds(imputed, means)
  const z = zScoreRows(imputed, means, stds)

  // Covariance (d x d), sample cov with ddof=1 when n>1
  const denom = Math.max(n - 1, 1)
  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0))
  for (const row of z) {
    for (let i = 0; i < d; i++) {
      for (let j = i; j < d; j++) {
        cov[i][j] += row[i] * row[j]
      }
    }
  }
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      cov[i][j] /= denom
      cov[j][i] = cov[i][j]
    }
  }

  const { values, vectors } = jacobiEigen(cov)
  const kk = Math.min(k, d)
  // components: kk x d — each row is an eigenvector transposed (column of vectors)
  const components: number[][] = []
  for (let c = 0; c < kk; c++) {
    const axis = new Array(d)
    for (let r = 0; r < d; r++) axis[r] = vectors[r][c]
    components.push(axis)
  }

  const explainedVariance = values.slice(0, kk)
  const totalVar = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1
  const explainedVarianceRatio = explainedVariance.map((v) => Math.max(v, 0) / totalVar)

  const scores = z.map((row) => {
    const out: number[] = []
    for (let c = 0; c < kk; c++) {
      let s = 0
      for (let j = 0; j < d; j++) s += row[j] * components[c][j]
      out.push(s)
    }
    return out
  })

  return { means, stds, components, explainedVariance, explainedVarianceRatio, scores }
}

export function projectRow(
  row: number[],
  means: number[],
  stds: number[],
  components: number[][],
): [number, number, number] {
  const d = means.length
  const z = new Array(d)
  for (let j = 0; j < d; j++) {
    const v = Number.isFinite(row[j]) ? row[j] : means[j]
    z[j] = (v - means[j]) / stds[j]
  }
  const out: [number, number, number] = [0, 0, 0]
  for (let c = 0; c < Math.min(3, components.length); c++) {
    let s = 0
    for (let j = 0; j < d; j++) s += z[j] * components[c][j]
    out[c] = s
  }
  return out
}

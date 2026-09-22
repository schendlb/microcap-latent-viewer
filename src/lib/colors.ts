import { Color } from 'three'

/**
 * Temporal color spectrum for past/present/future visualization.
 * 
 * - Past (age 0-1): Cool blues/purples, fading toward dimmer
 * - Present (age = 0): Peak clarity, bright cyan/white
 * - Future: Warm oranges/yellows
 * 
 * @param temporalPosition -1 (past) → 0 (present) → 1 (future)
 * @param venueHint Optional venue color to blend in
 * @returns Color for rendering
 */
export function getTemporalColor(
  temporalPosition: number,
  venueHint?: string,
): string {
  const clampedPos = Math.max(-1, Math.min(1, temporalPosition))
  
  let baseColor: Color
  
  if (clampedPos < 0) {
    // Past: cool spectrum (deep blue → cyan)
    const t = (clampedPos + 1) // 0 (oldest) → 1 (near present)
    const startColor = new Color('#1a2540') // Deep blue
    const endColor = new Color('#4a9eff')   // Bright cyan
    baseColor = new Color().lerpColors(startColor, endColor, t)
  } else {
    // Present to Future: cyan → yellow/orange
    const t = clampedPos // 0 (present) → 1 (future)
    const startColor = new Color('#4af4ff') // Bright cyan (present)
    const endColor = new Color('#ffaa33')   // Warm orange (future)
    baseColor = new Color().lerpColors(startColor, endColor, t)
  }
  
  // Optional: blend with venue color for secondary cue
  if (venueHint) {
    const venueColor = new Color(venueHint)
    baseColor.lerp(venueColor, 0.15) // Subtle venue tint
  }
  
  return `#${baseColor.getHexString()}`
}

/**
 * Get opacity for ghost trail based on age.
 * Older = more transparent, newer = more opaque.
 */
export function getGhostOpacity(
  stepIndex: number,
  totalSteps: number,
): number {
  // Fade from 0.15 (oldest) to 0.6 (newest/closest to present)
  const t = stepIndex / Math.max(totalSteps - 1, 1)
  return 0.15 + t * 0.45
}

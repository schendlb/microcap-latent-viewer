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
    // Past: cool spectrum (deep blue → cyan) - darker and more saturated
    const t = (clampedPos + 1) // 0 (oldest) → 1 (near present)
    const startColor = new Color('#0a1428') // Very deep blue (darker)
    const endColor = new Color('#2a6bcc')   // Medium blue (less bright than present)
    baseColor = new Color().lerpColors(startColor, endColor, Math.pow(t, 0.8))
  } else {
    // Present to Future: bright cyan → warm orange
    const t = clampedPos // 0 (present) → 1 (future)
    const startColor = new Color('#00e5ff') // Very bright cyan (present)
    const endColor = new Color('#ff8833')   // Bright warm orange (future)
    baseColor = new Color().lerpColors(startColor, endColor, t)
  }
  
  // Optional: blend with venue color for secondary cue (less influence)
  if (venueHint) {
    const venueColor = new Color(venueHint)
    baseColor.lerp(venueColor, 0.1) // Reduced from 0.15 to 0.1
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
  // Fade from 0.2 (oldest) to 0.55 (newest/closest to present) - dimmer than present
  const t = stepIndex / Math.max(totalSteps - 1, 1)
  return 0.2 + t * 0.35
}

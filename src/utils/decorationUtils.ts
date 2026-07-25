/**
 * decorationUtils.ts
 *
 * Pure utility functions for the 4-Step Adaptive AI Decoration Pipeline.
 * No React dependency — safe to import in tests and server-side code.
 */

/**
 * Step 1 — Geometric Snapshot
 *
 * Calculates the minimum safe radius that guarantees no background image art
 * overlaps table names, chair nodes, or seating labels.
 *
 * The safe radius equals the distance from the canvas centre to the furthest
 * seat position, plus a configurable safety padding buffer.
 *
 * @param seats       Array of seat positions in SVG viewBox coordinates.
 * @param cx          X coordinate of the canvas centre (default 200 for 400×400 viewBox).
 * @param cy          Y coordinate of the canvas centre (default 200).
 * @param safetyPadding  Extra clearance in SVG units added on top of the furthest seat (default 30).
 * @returns safeRadius in SVG units — the punch-out radius for the SVG <mask>.
 */
export function computeSafeRadius(
  seats: Array<{ x: number; y: number }>,
  cx = 200,
  cy = 200,
  safetyPadding = 30
): number {
  if (seats.length === 0) {
    // Fall back to a reasonable default if no seat positions are available
    return 110 + safetyPadding;
  }

  let maxDist = 0;
  for (const seat of seats) {
    const dx = seat.x - cx;
    const dy = seat.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      maxDist = dist;
    }
  }

  return maxDist + safetyPadding;
}

/**
 * Step 2 — Prompt Wrapping
 *
 * Intercepts the user's raw theme description and wraps it into a structured
 * prompt that instructs the image model to:
 *  - Paint decorative art only in the outer corners / vignette region.
 *  - Leave the centre of the canvas completely clear (negative space).
 *  - Use high contrast between the decoration and the centre void.
 *
 * @param userText  Raw theme description entered by the user.
 * @returns         Structured prompt string ready for the image generation API.
 */
export function buildDecorPrompt(userText: string): string {
  const trimmed = userText.trim();
  return [
    `Create a decorative background art panel for a round dinner table seating card layout.`,
    `Theme: "${trimmed}".`,
    `CRITICAL COMPOSITION RULES:`,
    `- The CENTRE 50% of the image must be completely empty white/transparent — this area is reserved for the printed table name and guest seat labels.`,
    `- All decorative elements (florals, borders, patterns, motifs) must be confined to the OUTER EDGES and CORNERS only, forming a vignette frame.`,
    `- Use a soft radial fade from the outer decoration inward toward the empty centre.`,
    `- Style: elegant, high-end event stationery. Flat/watercolour illustration, NOT photographic.`,
    `- Aspect ratio: A4 landscape (wider than tall).`,
    `- Background: soft white or cream, never dark in the centre.`,
    `- Do NOT render any text, numbers, people, or chairs in the image.`,
  ].join(' ');
}

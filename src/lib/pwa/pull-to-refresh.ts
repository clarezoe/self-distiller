export const PULL_RESISTANCE = 0.5;
export const PULL_THRESHOLD = 70;
export const PULL_MAX = 120;

/** Map raw finger travel (px) to indicator offset with resistance, capped. */
export function pullDistance(rawDy: number): number {
  if (!Number.isFinite(rawDy) || rawDy <= 0) return 0;
  return Math.min(rawDy * PULL_RESISTANCE, PULL_MAX);
}

export function pullReady(distance: number): boolean {
  return distance >= PULL_THRESHOLD;
}

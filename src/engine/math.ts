/** Small numeric helpers shared by the calculations. */

/** Rounds to cents. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Euros as whole cents, the unit of the wage tax program. */
export function cents(value: number): number {
  return Math.round(value * 100)
}

/** Groups sorted numbers into runs of consecutive ones: [1, 2, 3, 5] → [[1, 2, 3], [5]]. */
export function consecutiveRuns(values: number[]): number[][] {
  const runs: number[][] = []
  for (const value of values) {
    const last = runs[runs.length - 1]
    if (last && last[last.length - 1] === value - 1) last.push(value)
    else runs.push([value])
  }
  return runs
}

import type { AllowanceVariant, ParentKey, PlanBlock, QuickParentPlan, QuickPlan, RelationshipStatus } from './types'

let idCounter = 0
export function createId(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export function sortBlocks(blocks: PlanBlock[]): PlanBlock[] {
  return [...blocks].sort((x, y) => x.from - y.from || x.to - y.to)
}

/** Inserts a block and trims or splits existing blocks it overlaps ("painting"). */
export function paintBlock(blocks: PlanBlock[], block: PlanBlock): PlanBlock[] {
  const result: PlanBlock[] = []
  for (const existing of blocks) {
    if (existing.id === block.id) continue
    if (existing.to < block.from || existing.from > block.to) {
      result.push(existing)
      continue
    }
    if (existing.from < block.from) result.push({ ...existing, to: block.from - 1 })
    if (existing.to > block.to) {
      result.push({ ...existing, id: existing.from < block.from ? createId('block') : existing.id, from: block.to + 1 })
    }
  }
  result.push(block)
  return sortBlocks(result)
}

/** Removes overlaps (later blocks in the list win) and invalid ranges. */
export function normalizeBlocks(blocks: PlanBlock[]): PlanBlock[] {
  let result: PlanBlock[] = []
  for (const block of blocks) {
    const from = Math.max(1, Math.round(block.from))
    const to = Math.max(from, Math.round(block.to))
    result = paintBlock(result, { ...block, from, to })
  }
  return result
}

function quickParentBlocks(plan: QuickParentPlan): PlanBlock[] {
  const blocks: PlanBlock[] = []
  let cursor = Math.max(1, plan.start)
  if (plan.leaveMonths > 0) {
    blocks.push({
      id: createId('block'),
      from: cursor,
      to: cursor + plan.leaveMonths - 1,
      leave: true,
      hours: 0,
      allowance: plan.leaveAllowance,
    })
    cursor += plan.leaveMonths
  }
  if (plan.partTimeMonths > 0) {
    blocks.push({
      id: createId('block'),
      from: cursor,
      to: cursor + plan.partTimeMonths - 1,
      leave: true,
      hours: plan.partTimeHours,
      allowance: plan.partTimeAllowance,
    })
  }
  return blocks
}

function fullLeaveEnd(plan: QuickParentPlan): number {
  return plan.leaveMonths > 0 ? Math.max(1, plan.start) + plan.leaveMonths - 1 : 0
}

/** Builds blocks from key figures (used for presets and to migrate old scenarios). */
export function generateQuickPlan(quick: QuickPlan, relationship: RelationshipStatus): Record<ParentKey, PlanBlock[]> {
  let a = quickParentBlocks(quick.a)
  let b = relationship === 'single' ? [] : quickParentBlocks(quick.b)
  if (quick.bonusMonths >= 2) {
    const start = quick.bonusStart ?? Math.max(fullLeaveEnd(quick.a), fullLeaveEnd(quick.b)) + 1
    const bonus = (): PlanBlock => ({
      id: createId('block'),
      from: start,
      to: start + quick.bonusMonths - 1,
      leave: true,
      hours: quick.bonusHours,
      allowance: 'bonus',
    })
    a = paintBlock(a, bonus())
    if (relationship !== 'single') b = paintBlock(b, bonus())
  }
  return { a, b }
}

export interface MonthPlan {
  leave: boolean
  hours: number
  hoursMissing: boolean
  allowance: AllowanceVariant
  blockId: string | null
}

export function expandBlocks(blocks: PlanBlock[], horizon: number, contractHours: number): MonthPlan[] {
  const months: MonthPlan[] = Array.from({ length: horizon }, () => ({
    leave: false,
    hours: contractHours,
    hoursMissing: false,
    allowance: 'none' as AllowanceVariant,
    blockId: null,
  }))
  for (const block of blocks) {
    for (let m = Math.max(1, block.from); m <= Math.min(horizon, block.to); m++) {
      months[m - 1] = {
        leave: block.leave,
        hours: block.hours ?? 0,
        hoursMissing: block.hours === null,
        allowance: block.allowance,
        blockId: block.id,
      }
    }
  }
  return months
}

export interface PlanPreset {
  id: string
  label: string
  description: string
  quick: QuickPlan
}

const noPartTime = { partTimeMonths: 0, partTimeHours: 30, partTimeAllowance: 'plus' as const }

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'classic',
    label: 'Klassisch 12 + 2',
    description: 'Mutter 12 Monate Basiselterngeld, danach Vater 2 Monate.',
    quick: {
      a: { start: 1, leaveMonths: 12, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 13, leaveMonths: 2, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'start-together',
    label: 'Start zu zweit',
    description: 'Mutter 12 Monate Basiselterngeld, Vater die ersten 4 Monate mit ElterngeldPlus zu Hause.',
    quick: {
      a: { start: 1, leaveMonths: 12, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 1, leaveMonths: 4, leaveAllowance: 'plus', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'equal',
    label: 'Halbe-Halbe 7 + 7',
    description: 'Mutter Monat 1–7, Vater Monat 8–14, jeweils Basiselterngeld.',
    quick: {
      a: { start: 1, leaveMonths: 7, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 8, leaveMonths: 7, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'plus-long',
    label: 'Länger mit Plus',
    description: 'Mutter 22 Monate mit ElterngeldPlus, danach Vater 4 Monate Teilzeit mit Plus.',
    quick: {
      a: { start: 1, leaveMonths: 22, leaveAllowance: 'plus', ...noPartTime },
      b: { start: 23, leaveMonths: 0, leaveAllowance: 'plus', partTimeMonths: 4, partTimeHours: 25, partTimeAllowance: 'plus' },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'partnership',
    label: 'Partnerschaftlich mit Bonus',
    description: 'Mutter Monat 1–10, Vater Monat 11–14, danach beide 4 Monate 30 Stunden mit Partnerschaftsbonus.',
    quick: {
      a: { start: 1, leaveMonths: 10, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 11, leaveMonths: 4, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 4,
      bonusStart: null,
      bonusHours: 30,
    },
  },
]

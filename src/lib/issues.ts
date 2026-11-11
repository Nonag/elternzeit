import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import type { Issue, IssueSeverity } from '@/engine/result'

export const SEVERITY_ORDER: IssueSeverity[] = ['error', 'warning', 'info', 'success']

/** Icon and colour per severity; tooltips have inverted colours and need their own. */
export const SEVERITY_STYLE: Record<IssueSeverity, { icon: typeof InfoIcon; className: string; tooltipClassName: string }> = {
  error: { icon: CircleAlertIcon, className: 'text-destructive', tooltipClassName: 'text-red-400 dark:text-red-600' },
  warning: { icon: TriangleAlertIcon, className: 'text-amber-600 dark:text-amber-400', tooltipClassName: 'text-amber-400 dark:text-amber-600' },
  info: { icon: InfoIcon, className: 'text-sky-600', tooltipClassName: 'text-sky-400 dark:text-sky-600' },
  success: { icon: CircleCheckIcon, className: 'text-emerald-600 dark:text-emerald-400', tooltipClassName: 'text-emerald-400 dark:text-emerald-600' },
}

/** Marking of a form field with an issue: red for errors, amber for warnings, a subtle blue for tips. */
export type FieldTone = 'error' | 'warning' | 'info'

/** Border of a marked field; errors use aria-invalid and its red border instead. */
export const TONE_BORDER: Record<FieldTone, string> = {
  error: '',
  warning: 'border-amber-500 ring-3 ring-amber-500/20 dark:border-amber-500/70 dark:ring-amber-500/30',
  info: 'border-sky-500/60 dark:border-sky-400/50',
}

export function strongestTone(issues: Issue[]): FieldTone | undefined {
  return (['error', 'warning', 'info'] as const).find((severity) => issues.some((issue) => issue.severity === severity))
}

export function sortBySeverity(issues: Issue[]): Issue[] {
  return [...issues].sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity))
}

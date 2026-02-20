// src/components/kanban/kanban-utils.ts
// Shared constants and helpers for Kanban boards (Task + CRM)

export const PRIORITY_COLORS = {
  urgent: { border: 'border-l-red-500', bg: 'bg-red-500', text: 'text-red-500' },
  high: { border: 'border-l-orange-500', bg: 'bg-orange-500', text: 'text-orange-500' },
  medium: { border: 'border-l-blue-500', bg: 'bg-blue-500', text: 'text-blue-500' },
  low: { border: 'border-l-gray-400', bg: 'bg-gray-400', text: 'text-gray-400' },
} as const

export const STATUS_DOT_COLORS: Record<string, string> = {
  // Task statuses
  backlog: 'bg-gray-400',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  blocked: 'bg-red-500',
  done: 'bg-emerald-500',
  // CRM stages
  new_lead: 'bg-gray-400',
  qualified: 'bg-blue-500',
  discovery: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-amber-500',
  won: 'bg-emerald-500',
  lost: 'bg-red-500',
}

export const STATUS_ACCENT_COLORS: Record<string, string> = {
  backlog: 'via-gray-400',
  todo: 'via-blue-500',
  in_progress: 'via-amber-500',
  review: 'via-purple-500',
  blocked: 'via-red-500',
  done: 'via-emerald-500',
  new_lead: 'via-gray-400',
  qualified: 'via-blue-500',
  discovery: 'via-indigo-500',
  proposal: 'via-purple-500',
  negotiation: 'via-amber-500',
  won: 'via-emerald-500',
  lost: 'via-red-500',
}

export const STAGE_CARD_BORDERS: Record<string, string> = {
  new_lead: 'border-l-gray-400',
  qualified: 'border-l-blue-500',
  discovery: 'border-l-indigo-500',
  proposal: 'border-l-purple-500',
  negotiation: 'border-l-amber-500',
  won: 'border-l-emerald-500',
  lost: 'border-l-red-400',
}

export function formatRelativeDate(timestamp: number): {
  label: string
  isOverdue: boolean
  isSoon: boolean
} {
  const now = Date.now()
  const diff = timestamp - now
  const days = Math.round(diff / (1000 * 60 * 60 * 24))

  if (days < -1) return { label: `${Math.abs(days)}d ago`, isOverdue: true, isSoon: false }
  if (days === -1) return { label: 'yesterday', isOverdue: true, isSoon: false }
  if (days === 0) return { label: 'today', isOverdue: false, isSoon: true }
  if (days === 1) return { label: 'tomorrow', isOverdue: false, isSoon: true }
  if (days <= 3) return { label: `in ${days}d`, isOverdue: false, isSoon: true }
  if (days <= 7) return { label: `in ${days}d`, isOverdue: false, isSoon: false }
  return { label: new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isOverdue: false, isSoon: false }
}

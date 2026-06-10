// ─── Pipeline stages (French) ──────────────────────────────────────────────
export const STAGES = [
  {
    id: 'prospect_qualifie',
    label: 'Prospect Qualifié',
    color: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    headerBg: 'bg-slate-50',
    headerBorder: 'border-slate-300',
    headerText: 'text-slate-700',
    countBg: 'bg-slate-200 text-slate-700',
  },
  {
    id: 'contact',
    label: 'Contact',
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    headerBg: 'bg-blue-50',
    headerBorder: 'border-blue-400',
    headerText: 'text-blue-700',
    countBg: 'bg-blue-200 text-blue-800',
  },
  {
    id: 'visite',
    label: 'Visite',
    color: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
    headerBg: 'bg-amber-50',
    headerBorder: 'border-amber-400',
    headerText: 'text-amber-700',
    countBg: 'bg-amber-200 text-amber-800',
  },
  {
    id: 'proposition',
    label: 'Proposition',
    color: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-500',
    headerBg: 'bg-indigo-50',
    headerBorder: 'border-indigo-400',
    headerText: 'text-indigo-700',
    countBg: 'bg-indigo-200 text-indigo-800',
  },
  {
    id: 'negociation',
    label: 'Négociation',
    color: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    headerBg: 'bg-orange-50',
    headerBorder: 'border-orange-400',
    headerText: 'text-orange-700',
    countBg: 'bg-orange-200 text-orange-800',
  },
  {
    id: 'conclu',
    label: 'Conclu',
    color: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50',
    headerBorder: 'border-emerald-400',
    headerText: 'text-emerald-700',
    countBg: 'bg-emerald-200 text-emerald-800',
  },
  {
    id: 'non_conclu',
    label: 'Non Conclu',
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    headerBg: 'bg-red-50',
    headerBorder: 'border-red-400',
    headerText: 'text-red-700',
    countBg: 'bg-red-200 text-red-800',
  },
  {
    id: 'acheve',
    label: 'Achevé',
    color: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
    headerBg: 'bg-purple-50',
    headerBorder: 'border-purple-400',
    headerText: 'text-purple-700',
    countBg: 'bg-purple-200 text-purple-800',
  },
]

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))

// ─── Priorities ──────────────────────────────────────────────────────────────
export const PRIORITIES = [
  { id: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    flag: 'text-red-500' },
  { id: 'normale', label: 'Normale', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',  flag: 'text-amber-400' },
  { id: 'basse',   label: 'Basse',   color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400',  flag: 'text-slate-400' },
]

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]))

// ─── Lead types ───────────────────────────────────────────────────────────────
export const LEAD_TYPES = [
  { id: 'school',          label: 'École' },
  { id: 'university',      label: 'Université' },
  { id: 'language_center', label: 'Centre de langues' },
  { id: 'bookstore',       label: 'Librairie' },
  { id: 'other',           label: 'Autre' },
]

export const PUBLISHERS = ['CUP', 'NGL', 'Pearson', 'Autre']

// ─── Activity types ───────────────────────────────────────────────────────────
export const ACTIVITY_ICONS = {
  note:         '📝',
  stage_change: '🔄',
  field_update: '✏️',
  call:         '📞',
  email:        '📧',
  meeting:      '🤝',
}

// ─── Custom field type keys (for reference) ───────────────────────────────────
export const CUSTOM_FIELD_TYPES = [
  'text', 'number', 'percentage', 'checkbox', 'date',
  'phone', 'email', 'dropdown', 'url', 'long_note', 'currency', 'stars',
]

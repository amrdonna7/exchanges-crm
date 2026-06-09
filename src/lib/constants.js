export const STAGES = [
  { id: 'prospect',          label: 'Prospect',          color: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400' },
  { id: 'contacted',         label: 'Contacted',         color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  { id: 'proposal_sent',     label: 'Proposal Sent',     color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  { id: 'negotiation',       label: 'Negotiation',       color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  { id: 'won',               label: 'Won',               color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { id: 'lost',              label: 'Lost',              color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
]

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))

export const LEAD_TYPES = [
  { id: 'school',          label: 'School' },
  { id: 'university',      label: 'University' },
  { id: 'language_center', label: 'Language Center' },
  { id: 'bookstore',       label: 'Bookstore' },
  { id: 'other',           label: 'Other' },
]

export const PUBLISHERS = ['CUP', 'NGL', 'Pearson', 'Other']

export const ACTIVITY_ICONS = {
  note:         '📝',
  stage_change: '🔄',
  field_update: '✏️',
  call:         '📞',
  email:        '📧',
  meeting:      '🤝',
}

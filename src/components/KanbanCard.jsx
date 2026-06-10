import { Link } from 'react-router-dom'
import { Calendar, Flag, AlignLeft } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { PRIORITY_MAP } from '../lib/constants'

function Avatar({ name }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  return (
    <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 ring-1 ring-white">
      <span className="text-white font-bold leading-none text-[9px]">{initials}</span>
    </div>
  )
}

function LeadAvatar({ avatarUrl, orgName }) {
  const initials = orgName
    ? orgName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={orgName}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-white border border-slate-200"
      />
    )
  }
  return (
    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
      <span className="text-slate-500 font-bold leading-none text-[10px]">{initials}</span>
    </div>
  )
}

// Shared card body — used both in the board and in the DragOverlay
export function CardBody({ lead, assignedUser, dragging = false }) {
  return (
    <div
      className={`bg-white rounded-lg border p-3 select-none shadow-sm
                  ${dragging
                    ? 'border-brand-400 shadow-2xl rotate-[1.5deg] scale-105 ring-2 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
    >
      <div className="flex items-start gap-2.5">
        <LeadAvatar avatarUrl={lead.avatar_url} orgName={lead.organization_name} />
        <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2 flex-1 min-w-0">
          {lead.organization_name}
        </p>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {assignedUser ? (
          <Avatar name={assignedUser.full_name ?? assignedUser.email} />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-100 border border-dashed border-slate-300 flex-shrink-0" />
        )}

        {lead.notes && <AlignLeft size={12} className="text-slate-400" />}
        <Calendar size={12} className="text-slate-300" />

        <span className="flex-1" />

        {lead.priority === 'urgente' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
            <Flag size={9} className="fill-red-500 text-red-500" />
            Urgente
          </span>
        )}
        {lead.priority === 'basse' && (
          <Flag size={11} className="text-slate-300" />
        )}
      </div>
    </div>
  )
}

// The draggable card placed inside a column
export default function KanbanCard({ lead, assignedUser }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { stageId: lead.stage },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing touch-none transition-opacity
                  ${isDragging ? 'opacity-30' : 'opacity-100'}`}
      style={{ outline: 'none' }}
    >
      {/* Wrap in Link only when not dragging so clicks still navigate */}
      {isDragging ? (
        <CardBody lead={lead} assignedUser={assignedUser} />
      ) : (
        <Link to={`/leads/${lead.id}`} tabIndex={-1} className="block focus:outline-none">
          <CardBody lead={lead} assignedUser={assignedUser} />
        </Link>
      )}
    </div>
  )
}

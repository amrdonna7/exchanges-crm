import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Flag, AlignLeft } from 'lucide-react'
import { Draggable } from '@hello-pangea/dnd'
import { PRIORITY_MAP } from '../lib/constants'

function Avatar({ name, size = 'sm' }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const sz = size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  return (
    <div className={`${sz} rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 ring-1 ring-white`}>
      <span className="text-white font-bold leading-none">{initials}</span>
    </div>
  )
}

export default function KanbanCard({ lead, index, assignedUser }) {
  const priority = PRIORITY_MAP[lead.priority]

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border border-slate-200 p-3 select-none
                      transition-shadow cursor-grab active:cursor-grabbing
                      ${snapshot.isDragging
                        ? 'shadow-xl border-brand-300 rotate-1 scale-[1.02]'
                        : 'shadow-sm hover:shadow-md hover:border-slate-300'}`}
        >
          <Link
            to={`/leads/${lead.id}`}
            onClick={e => { if (snapshot.isDragging) e.preventDefault() }}
            className="block"
          >
            <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2 hover:text-brand-600 transition-colors">
              {lead.organization_name}
            </p>
          </Link>

          {/* Bottom row */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {/* Assigned avatar */}
            {assignedUser ? (
              <Avatar name={assignedUser.full_name ?? assignedUser.email} />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-100 border border-dashed border-slate-300 flex-shrink-0" />
            )}

            {/* Has notes indicator */}
            {lead.notes && (
              <AlignLeft size={12} className="text-slate-400" />
            )}

            {/* Calendar placeholder */}
            <Calendar size={12} className="text-slate-300" />

            {/* Spacer */}
            <span className="flex-1" />

            {/* Priority badge — show Urgente always, others only if not normal */}
            {lead.priority === 'urgente' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                               bg-red-100 text-red-700">
                <Flag size={9} className="fill-red-500 text-red-500" />
                Urgente
              </span>
            )}
            {lead.priority === 'basse' && (
              <Flag size={11} className="text-slate-300" />
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { DragDropContext, Droppable } from '@hello-pangea/dnd'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, STAGE_MAP } from '../lib/constants'
import KanbanCard from '../components/KanbanCard'
import NewLeadModal from '../components/NewLeadModal'

function Column({ stage, leads, usersMap }) {
  return (
    <div className="flex-shrink-0 w-60 flex flex-col">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 mb-0
                       ${stage.headerBg} ${stage.headerBorder}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 ${stage.headerText}`}>
          {stage.label}
        </span>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${stage.countBg}`}>
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[80px] transition-colors
                        ${snapshot.isDraggingOver ? 'bg-brand-50 ring-2 ring-brand-200 ring-inset' : 'bg-slate-100/60'}`}
          >
            {leads.map((lead, idx) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                index={idx}
                assignedUser={lead.assigned_to ? usersMap[lead.assigned_to] : null}
              />
            ))}
            {provided.placeholder}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-14 flex items-center justify-center">
                <p className="text-[11px] text-slate-300 font-medium">Vide</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default function Pipeline() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const [{ data: leadsData }, { data: usersData }] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email'),
      ])
      setLeads(leadsData ?? [])
      const map = {}
      for (const u of usersData ?? []) map[u.id] = u
      setUsersMap(map)
      setLoading(false)
    }
    load()
  }, [])

  const handleDragEnd = useCallback(async (result) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStage = destination.droppableId
    const prevLead = leads.find(l => l.id === draggableId)
    if (!prevLead || prevLead.stage === newStage) return

    // Optimistic update
    setLeads(ls => ls.map(l => l.id === draggableId ? { ...l, stage: newStage } : l))

    const { error } = await supabase.from('leads').update({ stage: newStage }).eq('id', draggableId)
    if (error) {
      // Rollback
      setLeads(ls => ls.map(l => l.id === draggableId ? prevLead : l))
      return
    }

    await supabase.from('activities').insert({
      lead_id: draggableId,
      user_id: user?.id,
      type: 'stage_change',
      content: `Étape changée : ${STAGE_MAP[prevLead.stage]?.label} → ${STAGE_MAP[newStage]?.label}`,
      meta: { from: prevLead.stage, to: newStage },
    })
  }, [leads, user])

  const filtered = filter === 'mine' ? leads.filter(l => l.assigned_to === user?.id) : leads

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-800">Pipeline</h1>
          <span className="text-xs text-slate-400">{leads.length} prospects</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 font-semibold transition-colors
                ${filter === 'all' ? 'bg-brand-600 text-white rounded-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-3 py-1.5 font-semibold transition-colors
                ${filter === 'mine' ? 'bg-brand-600 text-white rounded-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Les miens
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs px-3 py-1.5">
            <Plus size={14} /> Nouveau
          </button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 min-w-max h-full pb-4 items-start">
              {STAGES.map(stage => (
                <Column
                  key={stage.id}
                  stage={stage}
                  leads={filtered.filter(l => l.stage === stage.id)}
                  usersMap={usersMap}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {showModal && (
        <NewLeadModal
          onClose={() => setShowModal(false)}
          onCreated={lead => { setLeads(ls => [lead, ...ls]); setShowModal(false) }}
        />
      )}
    </div>
  )
}

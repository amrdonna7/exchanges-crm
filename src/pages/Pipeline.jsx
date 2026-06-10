import { useEffect, useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, STAGE_MAP } from '../lib/constants'
import KanbanCard, { CardBody } from '../components/KanbanCard'
import NewLeadModal from '../components/NewLeadModal'

// ── Droppable column ─────────────────────────────────────────────────────────
function Column({ stage, leads, usersMap, isOver }) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div className="flex-shrink-0 w-60 flex flex-col">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-[3px] transition-colors
                    ${isOver ? stage.headerBg + ' brightness-95' : stage.headerBg}
                    ${stage.headerBorder}`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 ${stage.headerText}`}>
          {stage.label}
        </span>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${stage.countBg}`}>
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[120px] transition-all duration-150
                    ${isOver
                      ? 'bg-brand-50 ring-2 ring-inset ring-brand-300 shadow-inner'
                      : 'bg-slate-100/60'}`}
      >
        {leads.map(lead => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            assignedUser={lead.assigned_to ? usersMap[lead.assigned_to] : null}
          />
        ))}

        {leads.length === 0 && !isOver && (
          <div className="h-10 flex items-center justify-center">
            <p className="text-[11px] text-slate-300 font-medium">Vide</p>
          </div>
        )}

        {isOver && (
          <div className="h-10 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/50
                          flex items-center justify-center">
            <p className="text-[11px] text-brand-400 font-semibold">Déposer ici</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function Pipeline() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [activeId, setActiveId] = useState(null)   // card being dragged
  const [overStageId, setOverStageId] = useState(null) // column being hovered
  const leadsRef = useRef(leads)
  leadsRef.current = leads

  const sensors = useSensors(
    // Require 8px movement before drag starts — prevents accidental drags on clicks
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

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

  // Which lead is currently being dragged (for the DragOverlay)
  const activeLead = activeId ? leadsRef.current.find(l => l.id === activeId) : null
  const activeUser = activeLead?.assigned_to ? usersMap[activeLead.assigned_to] : null

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  function handleDragOver({ over }) {
    // over?.id is a stage id (column droppable) when hovering any column
    const stageId = STAGE_MAP[over?.id] ? over.id : null
    setOverStageId(stageId)
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    setOverStageId(null)

    if (!over) return

    const newStage = over.id
    // Guard: must be a valid stage
    if (!STAGE_MAP[newStage]) return

    const prev = leadsRef.current.find(l => l.id === active.id)
    if (!prev || prev.stage === newStage) return

    // Optimistic update
    setLeads(ls => ls.map(l => l.id === active.id ? { ...l, stage: newStage } : l))

    const { error } = await supabase.from('leads').update({ stage: newStage }).eq('id', active.id)
    if (error) {
      // Rollback
      setLeads(ls => ls.map(l => l.id === active.id ? prev : l))
      return
    }

    // Fire-and-forget activity log
    supabase.from('activities').insert({
      lead_id: active.id,
      user_id: user?.id,
      type: 'stage_change',
      content: `Étape : ${STAGE_MAP[prev.stage]?.label} → ${STAGE_MAP[newStage]?.label}`,
      meta: { from: prev.stage, to: newStage },
    })
  }

  function handleDragCancel() {
    setActiveId(null)
    setOverStageId(null)
  }

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
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-3 min-w-max pb-4 items-start">
              {STAGES.map(stage => (
                <Column
                  key={stage.id}
                  stage={stage}
                  leads={filtered.filter(l => l.stage === stage.id)}
                  usersMap={usersMap}
                  isOver={overStageId === stage.id}
                />
              ))}
            </div>

            {/* Floating card while dragging */}
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
              {activeLead ? (
                <div className="w-60 cursor-grabbing">
                  <CardBody lead={activeLead} assignedUser={activeUser} dragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

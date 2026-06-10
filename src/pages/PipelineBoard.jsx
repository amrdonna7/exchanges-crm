import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Search, X, Download, Settings, Loader2, MoreHorizontal,
  ChevronDown, Filter, Check, UserCircle, Flag,
} from 'lucide-react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors, useDroppable, pointerWithin,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePipelines } from '../contexts/PipelineContext'
import KanbanCard, { CardBody } from '../components/KanbanCard'
import NewLeadModal from '../components/NewLeadModal'
import PipelineSettingsModal from '../components/PipelineSettingsModal'
import * as XLSX from 'xlsx'

// ── Droppable column ──────────────────────────────────────────────────────────
function Column({ stage, leads, usersMap, isOver, onAddLead }) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  const dotColor = stage.color ?? '#6366f1'

  return (
    <div className="flex-shrink-0 w-64 flex flex-col max-h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-t-[3px] bg-white border-slate-200"
           style={{ borderTopColor: dotColor }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-slate-700 truncate">
          {stage.name}
        </span>
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
          {leads.length}
        </span>
        <button
          onClick={() => onAddLead(stage.id)}
          className="text-slate-400 hover:text-brand-600 transition-colors ml-1"
          title="Add lead to this stage"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[120px] overflow-y-auto transition-all duration-150
                    ${isOver
                      ? 'bg-brand-50 ring-2 ring-inset ring-brand-300'
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
            <p className="text-[11px] text-slate-300 font-medium">Empty</p>
          </div>
        )}
        {isOver && (
          <div className="h-10 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/50
                          flex items-center justify-center">
            <p className="text-[11px] text-brand-400 font-semibold">Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────────────────
export default function PipelineBoard() {
  const { pipelineId } = useParams()
  const { user } = useAuth()
  const { pipelines, stagesMap, addStage } = usePipelines()

  const pipeline = pipelines.find(p => p.id === pipelineId)
  const stages   = stagesMap[pipelineId] ?? []

  const [leads, setLeads]         = useState([])
  const [usersMap, setUsersMap]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [activeId, setActiveId]   = useState(null)
  const [overStageId, setOverStageId] = useState(null)

  const [searchQuery, setSearch]  = useState('')
  const [filterUser, setFilterUser] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const [showModal, setShowModal]           = useState(false)
  const [defaultStage, setDefaultStage]     = useState(null)
  const [showSettings, setShowSettings]     = useState(false)
  const [addingStage, setAddingStage]       = useState(false)
  const [newStageName, setNewStageName]     = useState('')

  const leadsRef = useRef(leads)
  leadsRef.current = leads

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const load = useCallback(async () => {
    if (!pipelineId) return
    setLoading(true)
    const [{ data: leadsData }, { data: usersData }] = await Promise.all([
      supabase.from('leads').select('*').eq('pipeline_id', pipelineId).order('created_at'),
      supabase.from('profiles').select('id, full_name, email, avatar_url'),
    ])
    setLeads(leadsData ?? [])
    const map = {}
    for (const u of usersData ?? []) map[u.id] = u
    setUsersMap(map)
    setLoading(false)
  }, [pipelineId])

  useEffect(() => { load() }, [load])

  // ── Search + filter ──────────────────────────────────────────────────────
  const keywords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean)

  function matchesSearch(lead) {
    if (!keywords.length) return true
    const haystack = [
      lead.organization_name, lead.contact_person, lead.city,
      lead.phone, lead.email, lead.notes,
    ].filter(Boolean).join(' ').toLowerCase()
    return keywords.every(kw => haystack.includes(kw))
  }

  const filteredLeads = leads.filter(l => {
    if (!matchesSearch(l)) return false
    if (filterUser && l.assigned_to !== filterUser) return false
    if (filterPriority && l.priority !== filterPriority) return false
    return true
  })

  function getStageLeads(stageId) {
    return filteredLeads.filter(l => l.stage === stageId)
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  function handleDragOver({ over }) {
    setOverStageId(over?.id ?? null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    setOverStageId(null)
    if (!over || active.id === over.id) return
    const lead = leadsRef.current.find(l => l.id === active.id)
    if (!lead || lead.stage === over.id) return

    const prev = leadsRef.current
    setLeads(ls => ls.map(l => l.id === active.id ? { ...l, stage: over.id } : l))

    const { error } = await supabase.from('leads').update({ stage: over.id }).eq('id', active.id)
    if (error) {
      setLeads(prev)
    } else {
      await supabase.from('activities').insert({
        lead_id: active.id, user_id: user?.id, type: 'stage_change',
        content: `Stage changed`,
        meta: { from: lead.stage, to: over.id },
      })
    }
  }

  const activeLead = leads.find(l => l.id === activeId)

  // ── Excel export ─────────────────────────────────────────────────────────
  function exportToExcel() {
    const stageNameMap = Object.fromEntries(stages.map(s => [s.id, s.name]))
    const rows = leads.map(l => ({
      'Organization':   l.organization_name ?? '',
      'Contact':        l.contact_person ?? '',
      'City':           l.city ?? '',
      'Phone':          l.phone ?? '',
      'Email':          l.email ?? '',
      'Stage':          stageNameMap[l.stage] ?? l.stage ?? '',
      'Priority':       l.priority ?? '',
      'Assigned To':    usersMap[l.assigned_to]?.full_name ?? usersMap[l.assigned_to]?.email ?? '',
      'Notes':          l.notes ?? '',
      'Created At':     l.created_at ? new Date(l.created_at).toLocaleString() : '',
      ...Object.entries(l.custom_fields ?? {}).reduce((acc, [k, v]) => {
        acc[`Custom: ${k}`] = Array.isArray(v) ? v.join(', ') : String(v ?? '')
        return acc
      }, {}),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `${pipeline?.name ?? 'Pipeline'}_leads.xlsx`)
  }

  // ── Add stage inline ─────────────────────────────────────────────────────
  async function handleAddStage() {
    if (!newStageName.trim()) return
    await addStage(pipelineId, newStageName.trim())
    setNewStageName('')
    setAddingStage(false)
  }

  const users = Object.values(usersMap)

  if (!pipeline && !loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Pipeline not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-bold text-slate-800 text-base truncate">{pipeline?.name}</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Pipeline settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="relative ml-auto flex-shrink-0 w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8 pr-8 py-1.5 text-xs w-full"
            placeholder="Search leads…"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors
                        ${(filterUser || filterPriority)
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter size={12} />
            Filter
            {(filterUser || filterPriority) && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 min-w-[220px] space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assigned To</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setFilterUser(null)}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-left transition-colors
                                ${!filterUser ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    All
                  </button>
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setFilterUser(u.id === filterUser ? null : u.id)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-left transition-colors
                                  ${filterUser === u.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[8px] font-bold">
                          {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {u.full_name ?? u.email}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Priority</p>
                <div className="space-y-0.5">
                  {[null, 'urgente', 'normale', 'basse'].map(p => (
                    <button
                      key={p ?? 'all'}
                      onClick={() => setFilterPriority(p)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-left transition-colors
                                  ${filterPriority === p ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {p ?? 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setFilterUser(null); setFilterPriority(null); setShowFilters(false) }}
                className="text-xs text-slate-400 hover:text-slate-600 w-full text-center pt-1"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <button
          onClick={exportToExcel}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg
                     border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <Download size={12} />
          Export
        </button>

        {/* New Lead */}
        <button
          onClick={() => { setDefaultStage(stages[0]?.id ?? null); setShowModal(true) }}
          className="btn-primary text-xs py-1.5 flex-shrink-0"
        >
          <Plus size={13} />
          New Lead
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full" style={{ minWidth: 'max-content' }}>
              {stages.map(stage => (
                <Column
                  key={stage.id}
                  stage={stage}
                  leads={getStageLeads(stage.id)}
                  usersMap={usersMap}
                  isOver={overStageId === stage.id}
                  onAddLead={stageId => { setDefaultStage(stageId); setShowModal(true) }}
                />
              ))}

              {/* Add stage column */}
              {!addingStage ? (
                <button
                  onClick={() => setAddingStage(true)}
                  className="flex-shrink-0 w-64 h-12 border-2 border-dashed border-slate-300
                             rounded-lg flex items-center justify-center gap-2 text-xs font-semibold
                             text-slate-400 hover:text-brand-600 hover:border-brand-300 transition-colors"
                >
                  <Plus size={14} /> Add Stage
                </button>
              ) : (
                <div className="flex-shrink-0 w-64 bg-white rounded-lg border border-slate-200 p-3 space-y-2 h-fit">
                  <input
                    autoFocus
                    className="input text-sm py-1.5"
                    placeholder="Stage name…"
                    value={newStageName}
                    onChange={e => setNewStageName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleAddStage()
                      if (e.key === 'Escape') { setAddingStage(false); setNewStageName('') }
                    }}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setAddingStage(false); setNewStageName('') }}
                      className="btn-secondary text-xs py-1 flex-1 justify-center"
                    >Cancel</button>
                    <button
                      onClick={handleAddStage}
                      disabled={!newStageName.trim()}
                      className="btn-primary text-xs py-1 flex-1 justify-center"
                    >Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
            {activeLead && (
              <CardBody
                lead={activeLead}
                assignedUser={activeLead.assigned_to ? usersMap[activeLead.assigned_to] : null}
                dragging
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {showModal && (
        <NewLeadModal
          pipelineId={pipelineId}
          stages={stages}
          defaultStageId={defaultStage}
          onClose={() => setShowModal(false)}
          onCreated={lead => {
            setLeads(ls => [...ls, lead])
            setShowModal(false)
          }}
        />
      )}

      {showSettings && (
        <PipelineSettingsModal
          pipelineId={pipelineId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Building2, User, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, STAGE_MAP, LEAD_TYPES, PUBLISHERS } from '../lib/constants'
import NewLeadModal from '../components/NewLeadModal'

function LeadCard({ lead, onStageChange }) {
  const stage = STAGE_MAP[lead.stage]
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-shadow">
      <Link to={`/leads/${lead.id}`} className="block">
        <p className="font-semibold text-slate-800 text-sm leading-snug hover:text-brand-600 transition-colors">
          {lead.organization_name}
        </p>
        {lead.contact_person && (
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1.5">
            <User size={11} /> {lead.contact_person}
          </p>
        )}
        {lead.city && (
          <p className="text-xs text-slate-400 mt-0.5">{lead.city}</p>
        )}
      </Link>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {lead.type && (
          <span className="badge bg-slate-100 text-slate-600">
            {LEAD_TYPES.find(t => t.id === lead.type)?.label ?? lead.type}
          </span>
        )}
        {lead.publisher_interest && (
          <span className="badge bg-brand-50 text-brand-700">{lead.publisher_interest}</span>
        )}
      </div>
      {/* Quick stage move */}
      <select
        value={lead.stage}
        onChange={e => onStageChange(lead.id, e.target.value)}
        className="mt-3 w-full text-xs border border-slate-200 rounded-md px-2 py-1
                   bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
        onClick={e => e.stopPropagation()}
      >
        {STAGES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}

function Column({ stage, leads, onStageChange }) {
  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{stage.label}</h3>
        <span className="ml-auto text-xs font-semibold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
          {leads.length}
        </span>
      </div>
      <div className="space-y-2.5 min-h-[120px]">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onStageChange={onStageChange} />
        ))}
        {leads.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg h-24 flex items-center justify-center">
            <p className="text-xs text-slate-300 font-medium">Empty</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'mine'

  useEffect(() => {
    loadLeads()
  }, [])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  async function handleStageChange(leadId, newStage) {
    const prev = leads.find(l => l.id === leadId)
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    const { error } = await supabase.from('leads').update({ stage: newStage }).eq('id', leadId)
    if (error) {
      setLeads(ls => ls.map(l => l.id === leadId ? prev : l))
      return
    }
    // Log activity
    await supabase.from('activities').insert({
      lead_id: leadId,
      user_id: user?.id,
      type: 'stage_change',
      content: `Stage changed from ${STAGE_MAP[prev.stage]?.label} to ${STAGE_MAP[newStage]?.label}`,
      meta: { from: prev.stage, to: newStage },
    })
  }

  const filtered = filter === 'mine' ? leads.filter(l => l.assigned_to === user?.id) : leads

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
          <p className="text-slate-500 text-sm mt-0.5">{leads.length} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === 'mine' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Mine
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full pb-2">
            {STAGES.map(stage => (
              <Column
                key={stage.id}
                stage={stage}
                leads={filtered.filter(l => l.stage === stage.id)}
                onStageChange={handleStageChange}
              />
            ))}
          </div>
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

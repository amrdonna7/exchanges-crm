import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, Phone, Mail, MapPin, Building2,
  BookOpen, User, Loader2, Plus, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, STAGE_MAP, LEAD_TYPES, PUBLISHERS, ACTIVITY_ICONS } from '../lib/constants'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [lead, setLead] = useState(null)
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: leadData }, { data: usersData }, { data: actData }] = await Promise.all([
        supabase.from('leads').select('*, assigned_user:profiles!leads_assigned_to_fkey(full_name, email)').eq('id', id).single(),
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('activities').select('*, user:profiles(full_name, email)')
          .eq('lead_id', id).order('created_at', { ascending: false }),
      ])
      if (!leadData) { navigate('/pipeline'); return }
      setLead(leadData)
      setUsers(usersData ?? [])
      setActivities(actData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  function updateField(field, value) {
    setLead(l => ({ ...l, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    const prevLead = lead
    const { data, error } = await supabase
      .from('leads')
      .update({
        organization_name: lead.organization_name,
        contact_person: lead.contact_person,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        type: lead.type,
        publisher_interest: lead.publisher_interest,
        stage: lead.stage,
        assigned_to: lead.assigned_to,
        notes: lead.notes,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (!error) {
      setLead(data)
      setDirty(false)
      // Log field update activity
      await supabase.from('activities').insert({
        lead_id: id,
        user_id: user?.id,
        type: 'field_update',
        content: 'Lead details updated',
      })
      const { data: newActs } = await supabase.from('activities')
        .select('*, user:profiles(full_name, email)')
        .eq('lead_id', id).order('created_at', { ascending: false })
      setActivities(newActs ?? [])
    }
  }

  async function handleStageChange(newStage) {
    const prevStage = lead.stage
    updateField('stage', newStage)
    const { error } = await supabase.from('leads').update({ stage: newStage }).eq('id', id)
    if (!error) {
      await supabase.from('activities').insert({
        lead_id: id,
        user_id: user?.id,
        type: 'stage_change',
        content: `Stage changed from ${STAGE_MAP[prevStage]?.label} to ${STAGE_MAP[newStage]?.label}`,
        meta: { from: prevStage, to: newStage },
      })
      const { data: newActs } = await supabase.from('activities')
        .select('*, user:profiles(full_name, email)')
        .eq('lead_id', id).order('created_at', { ascending: false })
      setActivities(newActs ?? [])
      setDirty(false)
    }
  }

  async function handleAddNote() {
    if (!noteInput.trim()) return
    setAddingNote(true)
    const { data: act } = await supabase.from('activities').insert({
      lead_id: id,
      user_id: user?.id,
      type: noteType,
      content: noteInput.trim(),
    }).select('*, user:profiles(full_name, email)').single()
    setAddingNote(false)
    setNoteInput('')
    if (act) setActivities(a => [act, ...a])
  }

  async function handleDelete() {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('leads').delete().eq('id', id)
    navigate('/pipeline')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stage = STAGE_MAP[lead?.stage]

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link to="/pipeline" className="btn-ghost text-slate-500">
          <ArrowLeft size={16} /> Pipeline
        </Link>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          )}
          <button
            onClick={handleDelete}
            className="btn-ghost text-red-500 hover:bg-red-50"
            disabled={deleting}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-brand-600" />
              </div>
              <div className="flex-1">
                <input
                  className="text-xl font-bold text-slate-800 w-full bg-transparent border-0 outline-none
                             focus:bg-slate-50 focus:rounded-lg focus:px-2 focus:py-1 -ml-0 transition-all"
                  value={lead.organization_name}
                  onChange={e => updateField('organization_name', e.target.value)}
                />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`badge ${stage?.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stage?.dot} mr-1.5`} />
                    {stage?.label}
                  </span>
                  {lead.type && (
                    <span className="badge bg-slate-100 text-slate-600">
                      {LEAD_TYPES.find(t => t.id === lead.type)?.label}
                    </span>
                  )}
                  {lead.publisher_interest && (
                    <span className="badge bg-brand-50 text-brand-700">{lead.publisher_interest}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-5">Contact Details</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Contact Person">
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-8" value={lead.contact_person ?? ''}
                    onChange={e => updateField('contact_person', e.target.value)} placeholder="—" />
                </div>
              </Field>
              <Field label="City">
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-8" value={lead.city ?? ''}
                    onChange={e => updateField('city', e.target.value)} placeholder="—" />
                </div>
              </Field>
              <Field label="Phone">
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-8" value={lead.phone ?? ''}
                    onChange={e => updateField('phone', e.target.value)} placeholder="—" />
                </div>
              </Field>
              <Field label="Email">
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-8" type="email" value={lead.email ?? ''}
                    onChange={e => updateField('email', e.target.value)} placeholder="—" />
                </div>
              </Field>
              <Field label="Type">
                <select className="input" value={lead.type ?? ''} onChange={e => updateField('type', e.target.value)}>
                  <option value="">Select…</option>
                  {LEAD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Publisher Interest">
                <select className="input" value={lead.publisher_interest ?? ''}
                  onChange={e => updateField('publisher_interest', e.target.value)}>
                  <option value="">Select…</option>
                  {PUBLISHERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Notes</h3>
            <textarea
              className="input resize-none h-28"
              value={lead.notes ?? ''}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Add notes about this lead…"
            />
            {dirty && (
              <button onClick={handleSave} className="btn-primary mt-3" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Notes
              </button>
            )}
          </div>

          {/* Activity log */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Activity Log</h3>

            {/* Add activity */}
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-3">
              <div className="flex gap-2">
                {['note', 'call', 'email', 'meeting'].map(t => (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                      ${noteType === t ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {ACTIVITY_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={`Log a ${noteType}…`}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <button onClick={handleAddNote} className="btn-primary px-3" disabled={addingNote || !noteInput.trim()}>
                  {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                </button>
              </div>
            </div>

            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                    <span className="text-base mt-0.5 flex-shrink-0">{ACTIVITY_ICONS[act.type] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{act.content}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {act.user?.full_name ?? act.user?.email ?? 'Unknown'}
                      </p>
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(act.created_at).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Stage selector */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Pipeline Stage</h3>
            <div className="space-y-1.5">
              {STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStageChange(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${lead.stage === s.id
                      ? 'bg-brand-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned to */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Assigned To</h3>
            <select
              className="input text-sm"
              value={lead.assigned_to ?? ''}
              onChange={e => { updateField('assigned_to', e.target.value || null) }}
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
              ))}
            </select>
          </div>

          {/* Meta */}
          <div className="card p-5 text-xs text-slate-500 space-y-2">
            <div className="flex justify-between">
              <span>Created</span>
              <span className="font-medium text-slate-700">
                {new Date(lead.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="font-medium text-slate-700">
                {new Date(lead.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

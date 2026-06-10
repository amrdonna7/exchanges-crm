import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Trash2, Loader2, Plus, Clock, Flag, User, Check,
  ChevronDown, Calendar, Timer, Camera, Download,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePipelines } from '../contexts/PipelineContext'
import ChampsSection from '../components/ChampsSection'
import * as XLSX from 'xlsx'

const PRIORITIES = [
  { id: 'urgente', label: 'Urgent',  color: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    flag: 'text-red-500' },
  { id: 'normale', label: 'Normal',  color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',  flag: 'text-amber-400' },
  { id: 'basse',   label: 'Low',     color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400',  flag: 'text-slate-400' },
]
const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]))

const ACTIVITY_ICONS = { note:'📝', stage_change:'🔄', field_update:'✏️', call:'📞', email:'📧', meeting:'🤝' }

function EditableTitle({ value, onChange }) {
  return (
    <input
      className="text-xl font-bold text-slate-900 w-full bg-transparent border-0 outline-none
                 hover:bg-slate-50 focus:bg-slate-100 rounded px-1 -mx-1 py-0.5 transition-colors"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function BadgeSelector({ options, value, onChange, renderOption }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="focus:outline-none">{renderOption(value)}</button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 min-w-[180px] py-1">
          {options.map(opt => (
            <button key={opt.id} onClick={() => { onChange(opt.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left">
              {renderOption(opt.id, true)}
              {opt.id === value && <Check size={12} className="ml-auto text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserPill({ users, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const assigned = users.find(u => u.id === value)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const initials = assigned
    ? (assigned.full_name ?? assigned.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : null
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors">
        {assigned ? (
          <>
            <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">{initials}</span>
            </div>
            <span className="font-medium">{assigned.full_name ?? assigned.email}</span>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
              <User size={10} className="text-slate-300" />
            </div>
            <span className="text-slate-400">Unassigned</span>
          </>
        )}
        <ChevronDown size={11} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 min-w-[200px] py-1">
          <button onClick={() => { onChange(null); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50">
            <div className="w-5 h-5 rounded-full border border-dashed border-slate-300" />
            Unassigned
            {!value && <Check size={11} className="ml-auto text-brand-600" />}
          </button>
          {users.map(u => {
            const ini = (u.full_name ?? u.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            return (
              <button key={u.id} onClick={() => { onChange(u.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50">
                <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-bold">{ini}</span>
                </div>
                <span className="text-slate-700 font-medium">{u.full_name ?? u.email}</span>
                {u.id === value && <Check size={11} className="ml-auto text-brand-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { stagesMap } = usePipelines()

  const [lead, setLead]           = useState(null)
  const [users, setUsers]         = useState([])
  const [activities, setActivities] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteType, setNoteType]   = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deleting, setDeleting]   = useState(false)

  const saveTimer    = useRef(null)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [{ data: leadData }, { data: usersData }, { data: actData }, { data: defsData }] =
        await Promise.all([
          supabase.from('leads').select('*').eq('id', id).single(),
          supabase.from('profiles').select('id, full_name, email'),
          supabase.from('activities').select('*, user:profiles(full_name, email)')
            .eq('lead_id', id).order('created_at', { ascending: false }),
          supabase.from('custom_field_definitions').select('*').order('sort_order'),
        ])
      if (!leadData) { navigate('/dashboard'); return }
      setLead({ ...leadData, custom_fields: leadData.custom_fields ?? {} })
      setUsers(usersData ?? [])
      setActivities(actData ?? [])
      // Filter field defs by pipeline or global (null pipeline_id)
      setFieldDefs((defsData ?? []).filter(d =>
        d.pipeline_id === leadData.pipeline_id || d.pipeline_id == null
      ))
      setLoading(false)
    }
    load()
  }, [id])

  const stages = lead?.pipeline_id ? (stagesMap[lead.pipeline_id] ?? []) : []

  function touchField(updater) {
    setLead(updater)
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(), 1500)
  }

  async function saveNow() {
    setSaving(true)
    setLead(latest => {
      if (!latest) return latest
      const payload = {
        organization_name: latest.organization_name,
        contact_person: latest.contact_person,
        phone: latest.phone,
        email: latest.email,
        city: latest.city,
        type: latest.type,
        publisher_interest: latest.publisher_interest,
        stage: latest.stage,
        priority: latest.priority,
        assigned_to: latest.assigned_to,
        notes: latest.notes,
        custom_fields: latest.custom_fields,
        avatar_url: latest.avatar_url,
      }
      supabase.from('leads').update(payload).eq('id', id).then(({ error }) => {
        setSaving(false)
        if (!error) setDirty(false)
      })
      return latest
    })
  }

  function update(field, value) { touchField(l => ({ ...l, [field]: value })) }
  function updateCustomFields(cf) { touchField(l => ({ ...l, custom_fields: cf })) }

  async function handleStageChange(newStage) {
    const prevStage = lead.stage
    update('stage', newStage)
    await supabase.from('leads').update({ stage: newStage }).eq('id', id)
    await supabase.from('activities').insert({
      lead_id: id, user_id: user?.id, type: 'stage_change',
      content: `Stage changed`,
      meta: { from: prevStage, to: newStage },
    })
    refreshActivities()
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('lead-avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { console.error('Upload failed:', uploadError); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('lead-avatars').getPublicUrl(path)
    const avatarUrl = `${publicUrl}?t=${Date.now()}`
    await supabase.from('leads').update({ avatar_url: avatarUrl }).eq('id', id)
    setLead(l => ({ ...l, avatar_url: avatarUrl }))
    setUploadingAvatar(false)
  }

  async function handleAddNote() {
    if (!noteInput.trim()) return
    setAddingNote(true)
    const { data: act } = await supabase.from('activities').insert({
      lead_id: id, user_id: user?.id, type: noteType, content: noteInput.trim(),
    }).select('*, user:profiles(full_name, email)').single()
    setAddingNote(false)
    setNoteInput('')
    if (act) setActivities(a => [act, ...a])
  }

  async function refreshActivities() {
    const { data } = await supabase.from('activities').select('*, user:profiles(full_name, email)')
      .eq('lead_id', id).order('created_at', { ascending: false })
    setActivities(data ?? [])
  }

  async function handleDelete() {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('leads').delete().eq('id', id)
    navigate(lead?.pipeline_id ? `/pipeline/${lead.pipeline_id}` : '/dashboard')
  }

  function exportLeadToExcel() {
    if (!lead) return
    const stageNameMap = Object.fromEntries(stages.map(s => [s.id, s.name]))
    const rows = [{
      'Organization': lead.organization_name ?? '',
      'Contact':      lead.contact_person ?? '',
      'City':         lead.city ?? '',
      'Phone':        lead.phone ?? '',
      'Email':        lead.email ?? '',
      'Stage':        stageNameMap[lead.stage] ?? lead.stage ?? '',
      'Priority':     lead.priority ?? '',
      'Notes':        lead.notes ?? '',
      'Created At':   lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
      ...Object.entries(lead.custom_fields ?? {}).reduce((acc, [k, v]) => {
        acc[`Custom: ${k}`] = Array.isArray(v) ? v.join(', ') : String(v ?? '')
        return acc
      }, {}),
    }]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lead')
    XLSX.writeFile(wb, `${lead.organization_name ?? 'lead'}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const priority = PRIORITY_MAP[lead.priority ?? 'normale']
  const currentStage = stages.find(s => s.id === lead.stage)

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left */}
      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
          <Link
            to={lead.pipeline_id ? `/pipeline/${lead.pipeline_id}` : '/dashboard'}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            <ArrowLeft size={13} /> Pipeline
          </Link>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Saving…
              </span>
            )}
            {!saving && dirty && <span className="text-xs text-brand-600 font-medium">Modified</span>}
            <button onClick={exportLeadToExcel}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
              <Download size={12} /> Export
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-w-3xl">
          {/* Avatar + Title */}
          <div className="flex items-start gap-4 mb-1">
            <div className="relative flex-shrink-0 group">
              <input ref={avatarInputRef} type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden" onChange={handleAvatarUpload} />
              <button onClick={() => avatarInputRef.current?.click()}
                className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 focus:outline-none
                           ring-2 ring-slate-200 hover:ring-brand-400 transition-all relative">
                {lead.avatar_url ? (
                  <img src={lead.avatar_url} alt={lead.organization_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <span className="text-slate-500 font-bold text-xl">
                      {lead.organization_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity
                                flex items-center justify-center rounded-full">
                  {uploadingAvatar
                    ? <Loader2 size={18} className="text-white animate-spin" />
                    : <Camera size={18} className="text-white" />}
                </div>
              </button>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <EditableTitle value={lead.organization_name} onChange={v => update('organization_name', v)} />
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            {/* Stage */}
            <span className="font-medium text-xs text-slate-500 w-16 text-right mr-1">Stage</span>
            {stages.length > 0 ? (
              <BadgeSelector
                options={stages.map(s => ({ id: s.id, label: s.name }))}
                value={lead.stage}
                onChange={handleStageChange}
                renderOption={(id, plain) => {
                  const s = stages.find(st => st.id === id)
                  if (!s) return <span className="text-xs text-slate-400">Unknown</span>
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
                                     ${plain ? '' : 'bg-indigo-50 text-indigo-700'}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color ?? '#6366f1' }} />
                      {s.name}
                    </span>
                  )
                }}
              />
            ) : (
              <span className="text-xs text-slate-400 px-2">{lead.stage ?? '—'}</span>
            )}

            <span className="text-slate-200 mx-1">|</span>
            <span className="font-medium text-xs text-slate-500 mr-1">Assignee</span>
            <UserPill users={users} value={lead.assigned_to} onChange={v => update('assigned_to', v)} />

            <span className="text-slate-200 mx-1">|</span>
            <span className="font-medium text-xs text-slate-500 mr-1">Priority</span>
            <BadgeSelector
              options={PRIORITIES}
              value={lead.priority ?? 'normale'}
              onChange={v => update('priority', v)}
              renderOption={(id, plain) => {
                const p = PRIORITY_MAP[id]
                if (!p) return null
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
                                   ${plain ? '' : p.color}`}>
                    <Flag size={9} className={p.flag} />
                    {p.label}
                  </span>
                )
              }}
            />
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Created {new Date(lead.created_at).toLocaleDateString('en-GB')}
            </span>
            <span className="flex items-center gap-1">
              <Timer size={11} />
              Updated {new Date(lead.updated_at).toLocaleDateString('en-GB')}
            </span>
          </div>

          {/* Champs */}
          <ChampsSection
            fieldDefs={fieldDefs}
            setFieldDefs={setFieldDefs}
            customFields={lead.custom_fields ?? {}}
            onChange={updateCustomFields}
            pipelineId={lead.pipeline_id}
          />

          {/* Notes */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
            <textarea
              className="input resize-none h-24 text-sm"
              value={lead.notes ?? ''}
              onChange={e => update('notes', e.target.value)}
              placeholder="Add notes about this lead…"
            />
          </div>

          {/* Activity log */}
          <div className="mt-6 pb-10">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity Log</h3>
            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2.5">
              <div className="flex gap-1.5 flex-wrap">
                {['note', 'call', 'email', 'meeting'].map(t => (
                  <button key={t} onClick={() => setNoteType(t)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                      ${noteType === t ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {ACTIVITY_ICONS[t]}{' '}
                    {{ note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting' }[t]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm"
                  placeholder={`Log a ${noteType}…`}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
                <button onClick={handleAddNote} disabled={addingNote || !noteInput.trim()} className="btn-primary px-3">
                  {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                </button>
              </div>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-sm mt-0.5 flex-shrink-0">{ACTIVITY_ICONS[act.type] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{act.content}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{act.user?.full_name ?? act.user?.email ?? 'Unknown'}</p>
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(act.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0">
        <div className="p-4 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contact</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Organization', field: 'organization_name' },
                { label: 'Person',       field: 'contact_person' },
                { label: 'City',         field: 'city' },
                { label: 'Phone',        field: 'phone' },
                { label: 'Email',        field: 'email', type: 'email' },
              ].map(({ label, field, type }) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
                  <input
                    type={type ?? 'text'}
                    className="flex-1 text-xs text-slate-700 bg-transparent border-0 outline-none
                               hover:bg-slate-50 focus:bg-slate-100 rounded px-1 py-0.5 transition-colors min-w-0"
                    value={lead[field] ?? ''}
                    onChange={e => update(field, e.target.value)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </div>

          {stages.length > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stages</h3>
                <div className="space-y-0.5">
                  {stages.map(s => (
                    <button key={s.id} onClick={() => handleStageChange(s.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                        ${lead.stage === s.id ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: lead.stage === s.id ? 'white' : (s.color ?? '#6366f1') }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Trash2, Loader2, Plus, Clock, Flag, User, Check,
  ChevronDown, Calendar, Timer, Tag,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, STAGE_MAP, PRIORITIES, PRIORITY_MAP, LEAD_TYPES, PUBLISHERS, ACTIVITY_ICONS } from '../lib/constants'
import ChampsSection from '../components/ChampsSection'

// ── Inline editable title ──────────────────────────────────────────────────
function EditableTitle({ value, onChange, onBlur }) {
  return (
    <input
      className="text-xl font-bold text-slate-900 w-full bg-transparent border-0 outline-none
                 hover:bg-slate-50 focus:bg-slate-100 rounded px-1 -mx-1 py-0.5 transition-colors"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
    />
  )
}

// ── Clickable badge selector ───────────────────────────────────────────────
function BadgeSelector({ options, value, onChange, renderOption }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="focus:outline-none">
        {renderOption(value)}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 min-w-[180px] py-1 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
            >
              {renderOption(opt.id, true)}
              {opt.id === value && <Check size={12} className="ml-auto text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── User avatar pill ───────────────────────────────────────────────────────
function UserPill({ users, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const assigned = users.find(u => u.id === value)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const initials = assigned
    ? (assigned.full_name ?? assigned.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors"
      >
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
            <span className="text-slate-400">Non assigné</span>
          </>
        )}
        <ChevronDown size={11} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 min-w-[200px] py-1">
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
          >
            <div className="w-5 h-5 rounded-full border border-dashed border-slate-300" />
            Non assigné
            {!value && <Check size={11} className="ml-auto text-brand-600" />}
          </button>
          {users.map(u => {
            const ini = (u.full_name ?? u.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            return (
              <button
                key={u.id}
                onClick={() => { onChange(u.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50"
              >
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

  const [lead, setLead] = useState(null)
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef(null)

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
      if (!leadData) { navigate('/pipeline'); return }
      setLead({ ...leadData, custom_fields: leadData.custom_fields ?? {} })
      setUsers(usersData ?? [])
      setActivities(actData ?? [])
      setFieldDefs(defsData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  // Debounced auto-save
  function touchField(updater) {
    setLead(updater)
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(updater), 1500)
  }

  async function saveNow(updaterOrLead) {
    setSaving(true)
    const current = typeof updaterOrLead === 'function'
      ? updaterOrLead(await new Promise(r => setLead(v => { r(v); return v })))
      : updaterOrLead

    setLead(latest => {
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
      }
      supabase.from('leads').update(payload).eq('id', id).then(({ error }) => {
        setSaving(false)
        if (!error) setDirty(false)
      })
      return latest
    })
  }

  function update(field, value) {
    touchField(l => ({ ...l, [field]: value }))
  }

  function updateCustomFields(newCf) {
    touchField(l => ({ ...l, custom_fields: newCf }))
  }

  async function handleStageChange(newStage) {
    const prevStage = lead.stage
    update('stage', newStage)
    await supabase.from('leads').update({ stage: newStage }).eq('id', id)
    await supabase.from('activities').insert({
      lead_id: id, user_id: user?.id, type: 'stage_change',
      content: `Étape : ${STAGE_MAP[prevStage]?.label} → ${STAGE_MAP[newStage]?.label}`,
      meta: { from: prevStage, to: newStage },
    })
    refreshActivities()
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
    if (!confirm('Supprimer ce prospect ? Cette action est irréversible.')) return
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

  const stage = STAGE_MAP[lead.stage]
  const priority = PRIORITY_MAP[lead.priority ?? 'normale']

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* ── Main content (left) ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
          <Link to="/pipeline" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium">
            <ArrowLeft size={13} /> Pipeline
          </Link>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Enregistrement…
              </span>
            )}
            {!saving && dirty && (
              <span className="text-xs text-brand-600 font-medium">Modifié</span>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-w-3xl">
          {/* Title */}
          <EditableTitle
            value={lead.organization_name}
            onChange={v => update('organization_name', v)}
            onBlur={() => {}}
          />

          {/* Meta row: Stage, Assigné, Priorité */}
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            {/* Statut */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
              <span className="font-medium w-16 text-right">Statut</span>
            </div>
            <BadgeSelector
              options={STAGES}
              value={lead.stage}
              onChange={handleStageChange}
              renderOption={(id, plain) => {
                const s = STAGE_MAP[id]
                if (!s) return null
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
                                   ${plain ? '' : s.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                )
              }}
            />

            <span className="text-slate-200 mx-1">|</span>

            {/* Assignés */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
              <span className="font-medium">Assignés</span>
            </div>
            <UserPill
              users={users}
              value={lead.assigned_to}
              onChange={v => update('assigned_to', v)}
            />

            <span className="text-slate-200 mx-1">|</span>

            {/* Priorité */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
              <span className="font-medium">Priorité</span>
            </div>
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

          {/* Dates row */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Créé le {new Date(lead.created_at).toLocaleDateString('fr-FR')}
            </span>
            <span className="flex items-center gap-1">
              <Timer size={11} />
              Modifié le {new Date(lead.updated_at).toLocaleDateString('fr-FR')}
            </span>
          </div>

          {/* ── Champs section ──────────────────────────────────────── */}
          <ChampsSection
            fieldDefs={fieldDefs}
            setFieldDefs={setFieldDefs}
            customFields={lead.custom_fields ?? {}}
            onChange={updateCustomFields}
          />

          {/* ── Notes ───────────────────────────────────────────────── */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
            <textarea
              className="input resize-none h-24 text-sm"
              value={lead.notes ?? ''}
              onChange={e => update('notes', e.target.value)}
              placeholder="Ajouter des notes sur ce prospect…"
            />
          </div>

          {/* ── Journal d'activité ────────────────────────────────── */}
          <div className="mt-6 pb-10">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Journal d'activité</h3>

            {/* Log input */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2.5">
              <div className="flex gap-1.5 flex-wrap">
                {['note', 'call', 'email', 'meeting'].map(t => (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                      ${noteType === t
                        ? 'bg-brand-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {ACTIVITY_ICONS[t]}{' '}
                    {{ note: 'Note', call: 'Appel', email: 'Email', meeting: 'RDV' }[t]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder={`Enregistrer un${noteType === 'email' ? ' ' : 'e '}${{ note: 'note', call: 'appel', email: 'email', meeting: 'réunion' }[noteType]}…`}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !noteInput.trim()}
                  className="btn-primary px-3"
                >
                  {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                </button>
              </div>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Aucune activité.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-sm mt-0.5 flex-shrink-0">{ACTIVITY_ICONS[act.type] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{act.content}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {act.user?.full_name ?? act.user?.email ?? 'Inconnu'}
                      </p>
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(act.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────────────── */}
      <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0">
        <div className="p-4 space-y-5">
          {/* Contact info */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contact</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Établissement', field: 'organization_name' },
                { label: 'Personne', field: 'contact_person' },
                { label: 'Ville', field: 'city' },
                { label: 'Téléphone', field: 'phone' },
                { label: 'Email', field: 'email', type: 'email' },
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

          <div className="border-t border-slate-100" />

          {/* Type & Publisher */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Classification</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24 flex-shrink-0">Type</span>
                <select
                  className="flex-1 text-xs text-slate-700 bg-transparent border-0 outline-none
                             hover:bg-slate-50 focus:bg-slate-100 rounded px-1 py-0.5 transition-colors cursor-pointer"
                  value={lead.type ?? ''}
                  onChange={e => update('type', e.target.value || null)}
                >
                  <option value="">—</option>
                  {LEAD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24 flex-shrink-0">Éditeur</span>
                <select
                  className="flex-1 text-xs text-slate-700 bg-transparent border-0 outline-none
                             hover:bg-slate-50 focus:bg-slate-100 rounded px-1 py-0.5 transition-colors cursor-pointer"
                  value={lead.publisher_interest ?? ''}
                  onChange={e => update('publisher_interest', e.target.value || null)}
                >
                  <option value="">—</option>
                  {PUBLISHERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Stage list */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Étape</h3>
            <div className="space-y-0.5">
              {STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStageChange(s.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                    ${lead.stage === s.id
                      ? 'bg-brand-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

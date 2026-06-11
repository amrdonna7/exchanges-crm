import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PRIORITIES = [
  { id: 'urgente', label: 'Urgent' },
  { id: 'normale', label: 'Normal' },
  { id: 'basse',   label: 'Low' },
]

export default function NewLeadModal({ pipelineId, stages = [], defaultStageId, onClose, onCreated }) {
  const { user } = useAuth()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
    stage: defaultStageId ?? stages[0]?.id ?? '',
    priority: 'normale',
    assigned_to: user?.id ?? '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').then(({ data }) => setUsers(data ?? []))
  }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Organization name is required'); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('leads')
      .insert({
        ...form,
        pipeline_id: pipelineId,
        created_by: user?.id,
        assigned_to: form.assigned_to || null,
        custom_fields: {},
      })
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message); return }
    await supabase.from('activities').insert({
      lead_id: data.id, user_id: user?.id, type: 'note', content: 'Lead created',
    })
    onCreated(data)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-base">New Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Organization *</label>
            <input className="input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="Acme School" autoFocus required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Contact Person</label>
              <input className="input" value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">City</label>
              <input className="input" value={form.city}
                onChange={e => set('city', e.target.value)} placeholder="Casablanca" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
              <input className="input" value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="+212 6 00 00 00 00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="contact@school.com" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Stage</label>
              <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assigned To</label>
              <select className="input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">—</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
            <textarea className="input resize-none h-16 text-sm" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Initial notes…" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center text-sm" disabled={loading}>
              {loading && <Loader2 size={13} className="animate-spin" />}
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

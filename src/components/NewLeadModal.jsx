import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STAGES, LEAD_TYPES, PUBLISHERS } from '../lib/constants'

export default function NewLeadModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    organization_name: '', contact_person: '', phone: '', email: '',
    city: '', type: '', publisher_interest: '', stage: 'prospect',
    assigned_to: user?.id ?? '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').then(({ data }) => setUsers(data ?? []))
  }, [])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.organization_name.trim()) { setError('Organization name is required'); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('leads')
      .insert({ ...form, created_by: user?.id, assigned_to: form.assigned_to || null })
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message); return }
    // Log creation activity
    await supabase.from('activities').insert({
      lead_id: data.id,
      user_id: user?.id,
      type: 'note',
      content: 'Lead created',
    })
    onCreated(data)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg">New Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Organization Name *</label>
            <input className="input" value={form.organization_name}
              onChange={e => set('organization_name', e.target.value)} placeholder="Acme Academy" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contact Person</label>
              <input className="input" value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">City</label>
              <input className="input" value={form.city}
                onChange={e => set('city', e.target.value)} placeholder="Cairo" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
              <input className="input" value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="+20 10 0000 0000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="info@school.eg" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="">Select type…</option>
                {LEAD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Publisher Interest</label>
              <select className="input" value={form.publisher_interest}
                onChange={e => set('publisher_interest', e.target.value)}>
                <option value="">Select publisher…</option>
                {PUBLISHERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Stage</label>
              <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Assigned To</label>
              <select className="input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
            <textarea className="input resize-none h-20" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Initial notes…" />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

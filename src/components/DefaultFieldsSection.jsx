import { useState, useRef } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Field definitions (label → leads column) ────────────────────────────────
export const DEFAULT_FIELDS = [
  { key: 'city',                    label: 'Ville',                          type: 'text' },
  { key: 'categorie',               label: 'Catégorie',                      type: 'text' },
  { key: 'cycle_college',           label: 'Cycle validé au Collège',        type: 'checkbox' },
  { key: 'cycle_lycee',             label: 'Cycle validé au Lycée',          type: 'checkbox' },
  { key: 'cycle_prescolaire',       label: 'Cycle validé au Préscolaire',    type: 'checkbox' },
  { key: 'cycle_primaire',          label: 'Cycle validé au Primaire',       type: 'checkbox' },
  { key: 'date_contact',            label: 'Date de contact',                type: 'date' },
  { key: 'date_derniere_adoption',  label: 'Date dernière adoption',         type: 'date' },
  { key: 'decisionnaire',           label: 'Décisionnaire',                  type: 'text' },
  { key: 'effectif_college',        label: 'Effectif Collège',               type: 'number' },
  { key: 'effectif_lycee',          label: 'Effectif Lycée',                 type: 'number' },
  { key: 'effectif_prescolaire',    label: 'Effectif Préscolaire',           type: 'number' },
  { key: 'effectif_primaire',       label: 'Effectif Primaire',              type: 'number' },
  { key: 'effectif_estime',         label: 'Effectif estimé',                type: 'number' },
  { key: 'email',                   label: 'Email',                          type: 'email' },
  { key: 'methode_utilisee',        label: 'Méthode utilisée',               type: 'text' },
  { key: 'programme_college',       label: 'Programme Collège',              type: 'text' },
  { key: 'programme_lycee',         label: 'Programme Lycée',                type: 'text' },
  { key: 'programme_maternelle',    label: 'Programme Maternelle',           type: 'text' },
  { key: 'programme_primaire',      label: 'Programme Primaire',             type: 'text' },
  { key: 'phone',                   label: 'Téléphone',                      type: 'text' },
  { key: 'volume_horaire',          label: 'Volume Horaire',                 type: 'dropdown', options: ['1H', '2H', '3H'] },
]

// ─── Display value as formatted text ─────────────────────────────────────────
function displayValue(field, value) {
  if (value == null || value === '') return null
  if (field.type === 'date') return new Date(value).toLocaleDateString('fr-FR')
  return String(value)
}

// ─── Single editable field row ────────────────────────────────────────────────
function FieldRow({ field, value, onSave, savedKey }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef = useRef(null)

  // ── Checkbox: toggle immediately, no edit mode ──
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
        <div className="w-52 flex-shrink-0 py-2.5 px-3">
          <span className="text-xs font-medium text-slate-500">{field.label}</span>
        </div>
        <div className="flex-1 py-2.5 pr-3">
          <button
            onClick={() => onSave(field.key, !value)}
            className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center
                        flex-shrink-0 transition-all duration-150
                        ${value
                          ? 'bg-brand-600 border-brand-600'
                          : 'border-slate-300 hover:border-brand-400 bg-white'}`}
          >
            {value && <Check size={11} className="text-white" strokeWidth={3} />}
          </button>
        </div>
      </div>
    )
  }

  // ── Dropdown ──
  if (field.type === 'dropdown') {
    return (
      <div className="flex items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
        <div className="w-52 flex-shrink-0 py-2.5 px-3">
          <span className="text-xs font-medium text-slate-500">{field.label}</span>
        </div>
        <div className="flex-1 py-2 pr-3">
          <select
            className="text-sm text-slate-700 bg-transparent border-0 outline-none cursor-pointer
                       hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 rounded-md
                       px-1 py-0.5 transition-all w-full"
            value={value ?? ''}
            onChange={e => onSave(field.key, e.target.value || null)}
          >
            <option value="">—</option>
            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {savedKey === field.key && (
          <span className="text-[11px] text-emerald-600 flex items-center gap-0.5 pr-3 flex-shrink-0">
            <Check size={10} strokeWidth={3} /> Enregistré
          </span>
        )}
      </div>
    )
  }

  // ── Text / number / email / date ──
  function startEdit() {
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  function commit() {
    setEditing(false)
    const trimmed = typeof draft === 'string' ? draft.trim() : draft
    const toSave = trimmed === '' ? null : (field.type === 'number' ? Number(trimmed) : trimmed)
    // Only save if value changed
    if (toSave !== (value ?? null)) {
      onSave(field.key, toSave)
    }
  }

  const displayed = displayValue(field, value)

  return (
    <div className="flex items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors group">
      <div className="w-52 flex-shrink-0 py-2.5 px-3">
        <span className="text-xs font-medium text-slate-500">{field.label}</span>
      </div>
      <div className="flex-1 py-2 pr-2 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            className="w-full text-sm text-slate-700 bg-white border border-brand-400 rounded-md
                       px-2 py-0.5 outline-none shadow-sm ring-1 ring-brand-200"
            value={draft ?? ''}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { setEditing(false) }
            }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-left w-full text-sm rounded-md px-1 py-0.5
                       group-hover:bg-white group-hover:shadow-sm group-hover:ring-1 group-hover:ring-slate-200
                       transition-all min-h-[24px] flex items-center"
          >
            {displayed
              ? <span className="text-slate-700">{displayed}</span>
              : <span className="text-slate-300">—</span>
            }
          </button>
        )}
      </div>
      {savedKey === field.key && !editing && (
        <span className="text-[11px] text-emerald-600 flex items-center gap-0.5 pr-3 flex-shrink-0">
          <Check size={10} strokeWidth={3} /> Enregistré
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DefaultFieldsSection({ lead, onUpdate, leadId }) {
  const [savedKey, setSavedKey] = useState(null)
  const saveTimers = useRef({})

  async function save(key, value) {
    const { error } = await supabase
      .from('leads')
      .update({ [key]: value })
      .eq('id', leadId)
    if (error) {
      console.error(`[DefaultFieldsSection] Failed to save "${key}":`, error.code, error.message, error.details)
    } else {
      setSavedKey(key)
      setTimeout(() => setSavedKey(k => k === key ? null : k), 2000)
    }
  }

  function handleSave(key, value) {
    // Update local state immediately for responsive UI
    onUpdate(key, value)
    // Debounce DB save for text fields; save immediately for checkbox/dropdown
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => save(key, value), 0)
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {DEFAULT_FIELDS.map(field => (
          <FieldRow
            key={field.key}
            field={field}
            value={lead?.[field.key]}
            onSave={handleSave}
            savedKey={savedKey}
          />
        ))}
      </div>
    </div>
  )
}

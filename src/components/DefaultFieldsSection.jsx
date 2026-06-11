import { useState, useRef } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

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

// ─── Single field row — always-editable ──────────────────────────────────────
function FieldRow({ fieldKey, label, type, options, value, leadId, onUpdate }) {
  const [localVal, setLocalVal] = useState(value ?? (type === 'checkbox' ? false : ''))
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  // Sync when parent lead prop changes (e.g. initial load)
  const prevValue = useRef(value)
  if (prevValue.current !== value) {
    prevValue.current = value
    setLocalVal(value ?? (type === 'checkbox' ? false : ''))
  }

  async function persist(val) {
    const { error } = await supabase.from('leads').update({ [fieldKey]: val }).eq('id', leadId)
    if (error) {
      console.error(`[DefaultFields] Save failed for "${fieldKey}":`, error.code, error.message, error.details)
    } else {
      onUpdate(fieldKey, val)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    }
  }

  function handleChange(val) {
    setLocalVal(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(val), 800)
  }

  const inputClass = `w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-md
                      px-2 py-1 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200
                      placeholder:text-slate-300 transition-colors`

  let editor
  if (type === 'checkbox') {
    editor = (
      <button
        onClick={() => { const n = !localVal; setLocalVal(n); persist(n) }}
        className={`w-[20px] h-[20px] rounded-[4px] border-2 flex items-center justify-center
                    flex-shrink-0 transition-all duration-150
                    ${localVal ? 'bg-brand-600 border-brand-600' : 'border-slate-300 hover:border-brand-400 bg-white'}`}
      >
        {localVal && <Check size={12} className="text-white" strokeWidth={3} />}
      </button>
    )
  } else if (type === 'dropdown') {
    editor = (
      <select
        className={inputClass}
        value={localVal ?? ''}
        onChange={e => handleChange(e.target.value || null)}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  } else {
    editor = (
      <input
        type={type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        className={inputClass}
        value={localVal ?? ''}
        placeholder="—"
        onChange={e => handleChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : (e.target.value || null))}
        onKeyDown={e => { if (e.key === 'Enter') { clearTimeout(saveTimer.current); persist(localVal) } }}
      />
    )
  }

  return (
    <div className="flex items-center border-b border-slate-100 last:border-0 py-1.5 px-3 gap-3">
      <div className="w-48 flex-shrink-0">
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{editor}</div>
      {saved && (
        <span className="text-[11px] text-emerald-600 flex items-center gap-0.5 flex-shrink-0">
          <Check size={10} strokeWidth={3} /> Saved
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DefaultFieldsSection({ lead, onUpdate, leadId }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Informations</h3>
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white py-1">
        {DEFAULT_FIELDS.map(f => (
          <FieldRow
            key={f.key}
            fieldKey={f.key}
            label={f.label}
            type={f.type}
            options={f.options}
            value={lead?.[f.key]}
            leadId={leadId}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}

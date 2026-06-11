import { useState, useRef, useCallback } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Field definitions (label → leads column) ────────────────────────────────
export const DEFAULT_FIELDS = [
  { key: 'ville',                   label: 'Ville',                          type: 'text' },
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

// Maps 'ville' → 'city' for the actual DB column name
const DB_KEY = { ville: 'city', phone: 'phone', email: 'email' }
function dbKey(key) { return DB_KEY[key] ?? key }

// ─── Inline field value editor ────────────────────────────────────────────────
function FieldEditor({ field, value, onChange }) {
  const base = `text-sm text-slate-700 bg-transparent border-0 outline-none w-full
                 placeholder:text-slate-300
                 focus:bg-white focus:rounded-md focus:px-2 focus:-mx-2 focus:py-0.5 focus:-my-0.5
                 focus:shadow-sm focus:ring-1 focus:ring-slate-200 transition-all`

  switch (field.type) {
    case 'text':
    case 'email':
      return (
        <input
          type={field.type === 'email' ? 'email' : 'text'}
          className={base}
          value={value ?? ''}
          placeholder="—"
          onChange={e => onChange(e.target.value || null)}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          className={`${base} w-32`}
          value={value ?? ''}
          placeholder="—"
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )

    case 'checkbox':
      return (
        <button
          onClick={() => onChange(!value)}
          className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center
                      flex-shrink-0 transition-all duration-150
                      ${value
                        ? 'bg-brand-600 border-brand-600'
                        : 'border-slate-300 hover:border-brand-400 bg-white'}`}
        >
          {value && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>
      )

    case 'date':
      return (
        <input
          type="date"
          className={`${base} text-xs`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        />
      )

    case 'dropdown':
      return (
        <select
          className={`${base} cursor-pointer`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )

    default:
      return <span className="text-xs text-slate-300">—</span>
  }
}

// ─── Single field row ─────────────────────────────────────────────────────────
function FieldRow({ field, value, onChange }) {
  return (
    <div className="flex items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors">
      <div className="w-48 flex-shrink-0 py-2.5 pr-3 pl-2">
        <span className="text-xs font-medium text-slate-500">{field.label}</span>
      </div>
      <div className="flex-1 py-2.5 pr-2 min-w-0">
        <FieldEditor field={field} value={value} onChange={onChange} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DefaultFieldsSection({ lead, onUpdate, leadId }) {
  const [savedKey, setSavedKey] = useState(null)
  const saveTimers = useRef({})

  const save = useCallback(async (key, value) => {
    const col = dbKey(key)
    const { error } = await supabase
      .from('leads')
      .update({ [col]: value })
      .eq('id', leadId)
    if (!error) {
      setSavedKey(key)
      setTimeout(() => setSavedKey(k => k === key ? null : k), 2000)
    }
  }, [leadId])

  function handleChange(key, value) {
    onUpdate(key, value)
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => save(key, value), 1200)
  }

  // For checkboxes save immediately (no debounce needed)
  function handleCheckbox(key, value) {
    onUpdate(key, value)
    save(key, value)
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
        {savedKey && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <Check size={10} strokeWidth={3} /> Enregistré
          </span>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {DEFAULT_FIELDS.map(field => {
          const col = dbKey(field.key)
          const value = lead[col] ?? lead[field.key]
          return (
            <FieldRow
              key={field.key}
              field={field}
              value={value}
              onChange={val =>
                field.type === 'checkbox'
                  ? handleCheckbox(col, val)
                  : handleChange(col, val)
              }
            />
          )
        })}
      </div>
    </div>
  )
}

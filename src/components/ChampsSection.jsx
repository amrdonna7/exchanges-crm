import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Check,
  Type, Hash, Percent, Calendar, Phone, Mail, List, ToggleLeft, GripVertical, Pencil, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DEFAULT_FIELD_TYPES } from '../lib/constants'

const TYPE_ICONS = {
  text:       <Type size={11} className="text-slate-400" />,
  number:     <Hash size={11} className="text-slate-400" />,
  percentage: <Percent size={11} className="text-slate-400" />,
  checkbox:   <ToggleLeft size={11} className="text-slate-400" />,
  date:       <Calendar size={11} className="text-slate-400" />,
  dropdown:   <List size={11} className="text-slate-400" />,
  phone:      <Phone size={11} className="text-slate-400" />,
  email:      <Mail size={11} className="text-slate-400" />,
}

function FieldValue({ def, value, onChange }) {
  const base = 'text-sm text-slate-700 bg-transparent border-0 outline-none w-full min-w-0 focus:bg-slate-50 focus:rounded px-1 -mx-1 transition-colors'

  if (def.type === 'checkbox') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
          ${value ? 'bg-brand-600 border-brand-600' : 'border-slate-300 hover:border-brand-400'}`}
      >
        {value && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>
    )
  }

  if (def.type === 'date') {
    return (
      <input
        type="date"
        className={`${base} text-xs`}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      />
    )
  }

  if (def.type === 'number' || def.type === 'percentage') {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <input
          type="number"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
        />
        {def.type === 'percentage' && value != null && (
          <span className="text-xs text-slate-400 flex-shrink-0">%</span>
        )}
      </div>
    )
  }

  if (def.type === 'dropdown' && def.options?.length) {
    return (
      <select
        className={`${base} cursor-pointer`}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {def.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      type={def.type === 'email' ? 'email' : 'text'}
      className={base}
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      placeholder="—"
    />
  )
}

function AddFieldPanel({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    const { data: maxRow } = await supabase
      .from('custom_field_definitions')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    const nextOrder = (maxRow?.sort_order ?? 0) + 1
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({ name: name.trim(), type, sort_order: nextOrder })
      .select()
      .single()
    setSaving(false)
    if (!error) onAdd(data)
  }

  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
      <p className="text-xs font-semibold text-slate-600">Nouveau champ</p>
      <input
        autoFocus
        className="input text-sm py-1.5"
        placeholder="Nom du champ"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }}
      />
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_FIELD_TYPES.map(ft => (
          <button
            key={ft.key}
            onClick={() => setType(ft.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors
              ${type === ft.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}
          >
            <span className="opacity-70">{ft.icon}</span> {ft.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary text-xs py-1 px-3">Annuler</button>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || saving}
          className="btn-primary text-xs py-1 px-3"
        >
          {saving ? '…' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

export default function ChampsSection({ fieldDefs, setFieldDefs, customFields, onChange }) {
  const [showEmpty, setShowEmpty] = useState(false)
  const [addingField, setAddingField] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const emptyCount = fieldDefs.filter(d => {
    const v = customFields[d.id]
    return v === null || v === undefined || v === '' || v === false
  }).length

  const visible = showEmpty
    ? fieldDefs
    : fieldDefs.filter(d => {
        const v = customFields[d.id]
        return v !== null && v !== undefined && v !== '' && v !== false
      })

  async function handleRename(def) {
    if (!renameValue.trim() || renameValue === def.name) { setRenamingId(null); return }
    await supabase.from('custom_field_definitions').update({ name: renameValue.trim() }).eq('id', def.id)
    setFieldDefs(ds => ds.map(d => d.id === def.id ? { ...d, name: renameValue.trim() } : d))
    setRenamingId(null)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce champ ?')) return
    await supabase.from('custom_field_definitions').delete().eq('id', id)
    setFieldDefs(ds => ds.filter(d => d.id !== id))
    const next = { ...customFields }
    delete next[id]
    onChange(next)
  }

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => setShowEmpty(v => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          {showEmpty ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Champs
        </button>
        <button
          onClick={() => setAddingField(v => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Plus size={13} /> Ajouter un champ
        </button>
      </div>

      {/* Field rows */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {(showEmpty ? fieldDefs : visible).length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Aucun champ renseigné.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {(showEmpty ? fieldDefs : visible).map((def, idx) => (
                <tr
                  key={def.id}
                  className={`group border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors`}
                >
                  {/* Field name */}
                  <td className="py-2 pl-3 pr-2 w-48 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="flex-shrink-0">{TYPE_ICONS[def.type]}</span>
                      {renamingId === def.id ? (
                        <input
                          autoFocus
                          className="text-xs font-medium text-slate-600 bg-white border border-brand-400 rounded px-1 py-0.5 w-full outline-none"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(def)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(def); if (e.key === 'Escape') setRenamingId(null) }}
                        />
                      ) : (
                        <span className="text-xs font-medium text-slate-500 truncate">{def.name}</span>
                      )}
                    </div>
                  </td>

                  {/* Field value */}
                  <td className="py-2 pr-2 align-middle">
                    <FieldValue
                      def={def}
                      value={customFields[def.id] ?? (def.type === 'checkbox' ? false : null)}
                      onChange={val => onChange({ ...customFields, [def.id]: val })}
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-2 pr-2 w-14 align-middle">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        onClick={() => { setRenamingId(def.id); setRenameValue(def.name) }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(def.id)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toggle empty fields */}
      {emptyCount > 0 && (
        <button
          onClick={() => setShowEmpty(v => !v)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          {showEmpty
            ? <><ChevronDown size={12} /> Masquer {emptyCount} champs vides</>
            : <><ChevronRight size={12} /> Afficher {emptyCount} champs vides</>}
        </button>
      )}

      {/* Add field panel */}
      {addingField && (
        <AddFieldPanel
          onClose={() => setAddingField(false)}
          onAdd={def => {
            setFieldDefs(ds => [...ds, def])
            setAddingField(false)
          }}
        />
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Type, Hash, Percent, CheckSquare, Calendar, Phone, Mail, List,
  Link2, FileText, Banknote, Star, GripVertical, MoreHorizontal,
  Plus, Check, ChevronDown, ChevronRight, Trash2, Pencil,
  RefreshCw, Settings2, ExternalLink, X, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Field type registry ──────────────────────────────────────────────────────
const FIELD_TYPES = [
  { key: 'text',       label: 'Texte',          Icon: Type,        bg: 'bg-slate-100',    fg: 'text-slate-600',   desc: 'Texte court' },
  { key: 'number',     label: 'Nombre',         Icon: Hash,        bg: 'bg-blue-100',     fg: 'text-blue-600',    desc: 'Valeur numérique' },
  { key: 'percentage', label: 'Pourcentage',    Icon: Percent,     bg: 'bg-violet-100',   fg: 'text-violet-600',  desc: 'Valeur en %' },
  { key: 'checkbox',   label: 'Case à cocher',  Icon: CheckSquare, bg: 'bg-emerald-100',  fg: 'text-emerald-600', desc: 'Oui / Non' },
  { key: 'date',       label: 'Date',           Icon: Calendar,    bg: 'bg-amber-100',    fg: 'text-amber-600',   desc: 'Date' },
  { key: 'phone',      label: 'Téléphone',      Icon: Phone,       bg: 'bg-green-100',    fg: 'text-green-600',   desc: 'Numéro de tél.' },
  { key: 'email',      label: 'Email',          Icon: Mail,        bg: 'bg-red-100',      fg: 'text-red-600',     desc: 'Adresse email' },
  { key: 'dropdown',   label: 'Liste',          Icon: List,        bg: 'bg-indigo-100',   fg: 'text-indigo-600',  desc: 'Choix dans une liste' },
  { key: 'url',        label: 'URL',            Icon: Link2,       bg: 'bg-cyan-100',     fg: 'text-cyan-600',    desc: 'Lien web' },
  { key: 'long_note',  label: 'Note longue',    Icon: FileText,    bg: 'bg-slate-100',    fg: 'text-slate-600',   desc: 'Texte multiligne' },
  { key: 'currency',   label: 'Devise (MAD)',   Icon: Banknote,    bg: 'bg-emerald-100',  fg: 'text-emerald-700', desc: 'Montant en dirhams' },
  { key: 'stars',      label: 'Étoiles',        Icon: Star,        bg: 'bg-amber-100',    fg: 'text-amber-500',   desc: 'Note de 1 à 5' },
]
const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(t => [t.key, t]))

function TypeIcon({ type, size = 12 }) {
  const ft = FIELD_TYPE_MAP[type]
  if (!ft) return null
  const { Icon, bg, fg } = ft
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded flex-shrink-0 ${bg}`}>
      <Icon size={size} className={fg} />
    </span>
  )
}

// ─── Click-outside hook ───────────────────────────────────────────────────────
function useClickOutside(ref, handler) {
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) handler() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [handler])
}

// ─── Saved badge ─────────────────────────────────────────────────────────────
function SavedBadge({ show }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600
                      transition-all duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <Check size={11} strokeWidth={3} /> Enregistré
    </span>
  )
}

// ─── Type picker menu ─────────────────────────────────────────────────────────
function TypePickerMenu({ onSelect, onClose, excludeKey }) {
  const ref = useRef(null)
  useClickOutside(ref, onClose)

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 w-72"
      style={{ top: 'calc(100% + 6px)', left: 0 }}
    >
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
        Choisir le type de champ
      </p>
      <div className="grid grid-cols-2 gap-1">
        {FIELD_TYPES.map(ft => (
          <button
            key={ft.key}
            onClick={() => { onSelect(ft.key); onClose() }}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium
                        transition-colors hover:bg-slate-50 group
                        ${ft.key === excludeKey ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 ${ft.bg}`}>
              <ft.Icon size={13} className={ft.fg} />
            </span>
            <span className="text-slate-700">{ft.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Dropdown options manager (inline panel) ──────────────────────────────────
function OptionsManager({ def, onSave, onClose }) {
  const [options, setOptions] = useState(def.options ?? [])
  const [newOpt, setNewOpt] = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(nextOptions) {
    setSaving(true)
    await supabase.from('custom_field_definitions').update({ options: nextOptions }).eq('id', def.id)
    setSaving(false)
    onSave({ ...def, options: nextOptions })
  }

  function addOption() {
    if (!newOpt.trim()) return
    const next = [...options, newOpt.trim()]
    setOptions(next)
    setNewOpt('')
    save(next)
  }

  function removeOption(idx) {
    const next = options.filter((_, i) => i !== idx)
    setOptions(next)
    save(next)
  }

  function commitEdit(idx) {
    if (!editVal.trim()) { setEditIdx(null); return }
    const next = options.map((o, i) => i === idx ? editVal.trim() : o)
    setOptions(next)
    setEditIdx(null)
    save(next)
  }

  return (
    <div className="mx-2 mb-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Settings2 size={12} /> Options de la liste
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      {options.length === 0 && (
        <p className="text-xs text-slate-400 italic">Aucune option. Ajoutez-en une ci-dessous.</p>
      )}

      <div className="space-y-1">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-1.5 group">
            {editIdx === idx ? (
              <input
                autoFocus
                className="input flex-1 py-1 text-xs"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => commitEdit(idx)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(idx); if (e.key === 'Escape') setEditIdx(null) }}
              />
            ) : (
              <button
                onClick={() => { setEditIdx(idx); setEditVal(opt) }}
                className="flex-1 text-left text-xs px-2 py-1 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-700 transition-all"
              >
                {opt}
              </button>
            )}
            <button
              onClick={() => removeOption(idx)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 pt-1">
        <input
          className="input flex-1 py-1 text-xs"
          placeholder="Nouvelle option…"
          value={newOpt}
          onChange={e => setNewOpt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addOption()}
        />
        <button
          onClick={addOption}
          disabled={!newOpt.trim() || saving}
          className="btn-primary text-xs px-2.5 py-1"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Field value renderer ─────────────────────────────────────────────────────
function FieldValue({ def, value, onChange }) {
  const base = `text-sm text-slate-700 bg-transparent border-0 outline-none w-full min-w-0
                placeholder:text-slate-300 focus:bg-white focus:rounded-md focus:px-1.5 focus:-mx-1.5
                focus:py-0.5 focus:-my-0.5 focus:shadow-sm focus:border focus:border-slate-200
                transition-all`

  switch (def.type) {
    case 'text':
    case 'phone':
      return (
        <input
          type="text"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="—"
        />
      )

    case 'email':
      return (
        <input
          type="email"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="—"
        />
      )

    case 'url':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <input
            type="url"
            className={`${base} flex-1`}
            value={value ?? ''}
            onChange={e => onChange(e.target.value || null)}
            placeholder="https://…"
          />
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-shrink-0 p-0.5 text-brand-500 hover:text-brand-700 transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )

    case 'number':
      return (
        <input
          type="number"
          className={`${base} w-28`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
        />
      )

    case 'percentage': {
      const pct = Math.min(100, Math.max(0, value ?? 0))
      return (
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="number"
            min="0" max="100"
            className={`${base} w-14 flex-shrink-0`}
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))))}
            placeholder="0"
          />
          <span className="text-xs text-slate-400 flex-shrink-0">%</span>
          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden min-w-[40px]">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${value != null ? pct : 0}%` }}
            />
          </div>
        </div>
      )
    }

    case 'currency':
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            className={`${base} w-28`}
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="0"
          />
          <span className="text-xs font-semibold text-slate-400 flex-shrink-0">MAD</span>
        </div>
      )

    case 'checkbox':
      return (
        <button
          onClick={() => onChange(!value)}
          className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center
                      flex-shrink-0 transition-all duration-150
                      ${value
                        ? 'bg-brand-600 border-brand-600 shadow-sm'
                        : 'border-slate-300 bg-white hover:border-brand-400'}`}
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
      if (!def.options?.length) {
        return <span className="text-xs text-slate-300 italic">Aucune option — gérer via ···</span>
      }
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

    case 'long_note':
      return (
        <textarea
          className={`${base} resize-none min-h-[56px] text-xs leading-relaxed`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="—"
          rows={3}
        />
      )

    case 'stars':
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onChange(n === value ? null : n)}
              className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={17}
                className={`transition-colors ${n <= (value ?? 0)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200 hover:text-amber-300'}`}
              />
            </button>
          ))}
          {value && (
            <button
              onClick={() => onChange(null)}
              className="ml-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors"
            >
              ×
            </button>
          )}
        </div>
      )

    default:
      return <span className="text-xs text-slate-300">—</span>
  }
}

// ─── Three-dots row menu ──────────────────────────────────────────────────────
function RowMenu({ def, onRename, onChangeType, onManageOptions, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600
                   opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
        title="Options"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 py-1 min-w-[175px]">
          <button
            onClick={() => { onRename(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={12} className="text-slate-400" /> Renommer
          </button>
          <button
            onClick={() => { onChangeType(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} className="text-slate-400" /> Changer le type
          </button>
          {def.type === 'dropdown' && (
            <button
              onClick={() => { onManageOptions(); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings2 size={12} className="text-slate-400" /> Gérer les options
            </button>
          )}
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={12} /> Supprimer le champ
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sortable field row ───────────────────────────────────────────────────────
function SortableFieldRow({
  def, value, onChange, onRename, onChangeType, onManageOptions, onDelete,
  renamingId, renameValue, setRenameValue, commitRename, cancelRename,
  changeTypeId, onChangeTypeSelect, onChangeTypeClose,
  managingOptionsId,
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: def.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  const isRenaming = renamingId === def.id
  const isChangingType = changeTypeId === def.id
  const isManagingOptions = managingOptionsId === def.id

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-start border-b border-slate-100 last:border-0
                    hover:bg-slate-50/80 transition-colors
                    ${isDragging ? 'bg-white shadow-lg rounded-lg border border-slate-200' : ''}`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          className="self-stretch px-1.5 flex items-center cursor-grab active:cursor-grabbing
                     opacity-0 group-hover:opacity-100 transition-opacity text-slate-300
                     hover:text-slate-500 focus:outline-none touch-none"
          title="Réordonner"
        >
          <GripVertical size={13} />
        </button>

        {/* Type icon + name */}
        <div className="flex items-center gap-2 py-2.5 pr-3 w-44 flex-shrink-0 min-w-0">
          {/* Type icon — click to change type */}
          <div className="relative flex-shrink-0">
            <button
              onClick={onChangeType}
              title="Changer le type"
              className="hover:opacity-70 transition-opacity"
            >
              <TypeIcon type={def.type} />
            </button>
            {isChangingType && (
              <TypePickerMenu
                excludeKey={def.type}
                onSelect={onChangeTypeSelect}
                onClose={onChangeTypeClose}
              />
            )}
          </div>

          {/* Name — click to rename */}
          {isRenaming ? (
            <input
              autoFocus
              className="text-xs font-medium text-slate-700 bg-white border border-brand-400 rounded-md
                         px-1.5 py-0.5 w-full outline-none shadow-sm"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') cancelRename()
              }}
            />
          ) : (
            <button
              onClick={onRename}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 truncate text-left
                         flex-1 min-w-0 transition-colors"
              title="Cliquer pour renommer"
            >
              {def.name}
            </button>
          )}
        </div>

        {/* Value */}
        <div className="flex-1 py-2.5 pr-2 min-w-0">
          <FieldValue
            def={def}
            value={value ?? (def.type === 'checkbox' ? false : null)}
            onChange={onChange}
          />
        </div>

        {/* Actions */}
        <div className="py-2 pr-1.5 flex-shrink-0 self-start mt-0.5">
          <RowMenu
            def={def}
            onRename={onRename}
            onChangeType={onChangeType}
            onManageOptions={onManageOptions}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Dropdown options manager — shown inline below the row */}
      {isManagingOptions && (
        <OptionsManager
          def={def}
          onSave={updated => onManageOptions(updated)}
          onClose={() => onManageOptions(null)}
        />
      )}
    </div>
  )
}

// ─── Add field button + menu ──────────────────────────────────────────────────
function AddFieldButton({ onAdd }) {
  const [step, setStep] = useState(null)   // null | 'type' | 'name'
  const [chosenType, setChosenType] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)
  const inputRef = useRef(null)

  useClickOutside(ref, () => {
    setStep(null)
    setChosenType(null)
    setName('')
  })

  function pickType(key) {
    setChosenType(key)
    const ft = FIELD_TYPE_MAP[key]
    setName(ft?.label ?? '')
    setStep('name')
    setTimeout(() => inputRef.current?.select(), 50)
  }

  async function create() {
    if (!name.trim() || !chosenType) return
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
      .insert({ name: name.trim(), type: chosenType, sort_order: nextOrder })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onAdd(data)
      setStep(null)
      setChosenType(null)
      setName('')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setStep(step === 'type' ? null : 'type')}
        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold
                   px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
      >
        <Plus size={13} /> Ajouter un champ
      </button>

      {/* Step 1 – choose type */}
      {step === 'type' && (
        <TypePickerMenu
          onSelect={pickType}
          onClose={() => setStep(null)}
        />
      )}

      {/* Step 2 – name the field */}
      {step === 'name' && chosenType && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-64"
          style={{ top: 'calc(100% + 6px)', left: 0 }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <TypeIcon type={chosenType} />
            <p className="text-xs font-semibold text-slate-600">Nom du champ</p>
          </div>
          <input
            ref={inputRef}
            autoFocus
            className="input text-sm py-1.5"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Décisionnaire"
            onKeyDown={e => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') { setStep('type'); setChosenType(null) }
            }}
          />
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setStep('type')} className="btn-secondary text-xs py-1 px-3 flex-1 justify-center">
              Retour
            </button>
            <button
              onClick={create}
              disabled={!name.trim() || saving}
              className="btn-primary text-xs py-1 px-3 flex-1 justify-center"
            >
              {saving ? '…' : 'Créer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ChampsSection ───────────────────────────────────────────────────────
export default function ChampsSection({ fieldDefs, setFieldDefs, customFields, onChange }) {
  const [showEmpty, setShowEmpty] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [changeTypeId, setChangeTypeId] = useState(null)
  const [managingOptionsId, setManagingOptionsId] = useState(null)
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  // ── Value helpers
  function isEmptyValue(def, val) {
    if (def.type === 'checkbox') return !val
    if (def.type === 'stars')    return val == null || val === 0
    return val == null || val === ''
  }

  const visibleDefs = showEmpty
    ? fieldDefs
    : fieldDefs.filter(d => !isEmptyValue(d, customFields[d.id]))

  const emptyCount = fieldDefs.filter(d => isEmptyValue(d, customFields[d.id])).length

  // ── Rename
  function startRename(def) {
    setRenamingId(def.id)
    setRenameValue(def.name)
  }

  async function commitRename() {
    const def = fieldDefs.find(d => d.id === renamingId)
    if (!def) { setRenamingId(null); return }
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === def.name) { setRenamingId(null); return }
    await supabase.from('custom_field_definitions').update({ name: trimmed }).eq('id', def.id)
    setFieldDefs(ds => ds.map(d => d.id === def.id ? { ...d, name: trimmed } : d))
    setRenamingId(null)
    flash()
  }

  // ── Change type
  async function handleChangeTypeSelect(defId, newType) {
    await supabase.from('custom_field_definitions').update({ type: newType }).eq('id', defId)
    setFieldDefs(ds => ds.map(d => d.id === defId ? { ...d, type: newType } : d))
    // Clear incompatible value
    onChange({ ...customFields, [defId]: null })
    setChangeTypeId(null)
    flash()
  }

  // ── Delete
  async function handleDelete(defId) {
    if (!confirm('Supprimer ce champ ? Les valeurs seront perdues pour tous les prospects.')) return
    await supabase.from('custom_field_definitions').delete().eq('id', defId)
    setFieldDefs(ds => ds.filter(d => d.id !== defId))
    const next = { ...customFields }
    delete next[defId]
    onChange(next)
    flash()
  }

  // ── Manage dropdown options
  function handleManageOptions(defId, updatedDef) {
    if (updatedDef === null) {
      // close
      setManagingOptionsId(null)
    } else if (updatedDef && typeof updatedDef === 'object') {
      // saved updated def
      setFieldDefs(ds => ds.map(d => d.id === defId ? updatedDef : d))
      setManagingOptionsId(null)
      flash()
    } else {
      // open
      setManagingOptionsId(defId)
    }
  }

  // ── Drag-to-reorder
  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = fieldDefs.findIndex(d => d.id === active.id)
    const newIdx = fieldDefs.findIndex(d => d.id === over.id)
    const reordered = arrayMove(fieldDefs, oldIdx, newIdx)
    setFieldDefs(reordered)
    // Persist new sort_order values
    await Promise.all(
      reordered.map((d, i) =>
        supabase.from('custom_field_definitions').update({ sort_order: i }).eq('id', d.id)
      )
    )
    flash()
  }

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Champs</h3>
        <SavedBadge show={saved} />
        <div className="ml-auto flex items-center gap-1">
          {emptyCount > 0 && (
            <button
              onClick={() => setShowEmpty(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600
                         px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors font-medium"
              title={showEmpty ? 'Masquer les champs vides' : 'Afficher les champs vides'}
            >
              {showEmpty
                ? <><EyeOff size={12} /> Masquer vides ({emptyCount})</>
                : <><Eye size={12} /> Afficher vides ({emptyCount})</>}
            </button>
          )}
          <AddFieldButton
            onAdd={def => {
              setFieldDefs(ds => [...ds, def])
              setShowEmpty(true)
              flash()
            }}
          />
        </div>
      </div>

      {/* Field list */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {visibleDefs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400">
              {emptyCount > 0
                ? `${emptyCount} champ${emptyCount > 1 ? 's' : ''} vide${emptyCount > 1 ? 's' : ''}. Cliquez « Afficher vides ».`
                : 'Aucun champ. Cliquez « Ajouter un champ ».'}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleDefs.map(d => d.id)} strategy={verticalListSortingStrategy}>
              {visibleDefs.map(def => (
                <SortableFieldRow
                  key={def.id}
                  def={def}
                  value={customFields[def.id]}
                  onChange={val => onChange({ ...customFields, [def.id]: val })}
                  onRename={() => startRename(def)}
                  onChangeType={() => setChangeTypeId(id => id === def.id ? null : def.id)}
                  onChangeTypeSelect={newType => handleChangeTypeSelect(def.id, newType)}
                  onChangeTypeClose={() => setChangeTypeId(null)}
                  onManageOptions={updatedDef => handleManageOptions(def.id, updatedDef)}
                  onDelete={() => handleDelete(def.id)}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  commitRename={commitRename}
                  cancelRename={() => setRenamingId(null)}
                  changeTypeId={changeTypeId}
                  managingOptionsId={managingOptionsId}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

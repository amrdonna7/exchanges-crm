import { useState, useRef, useEffect } from 'react'
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
  Type, Hash, CheckSquare, Calendar, List, Percent,
  DollarSign, AlignLeft, Globe, Star,
  GripVertical, MoreHorizontal, Plus, Check,
  Trash2, Pencil, RefreshCw, Settings2,
  ExternalLink, X, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Exactly 10 field types ──────────────────────────────────────────────────
const FIELD_TYPES = [
  { key: 'text',       label: 'Texte',         Icon: Type,        bg: 'bg-slate-100',   fg: 'text-slate-500',   desc: 'Texte court' },
  { key: 'number',     label: 'Nombre',        Icon: Hash,        bg: 'bg-blue-100',    fg: 'text-blue-600',    desc: 'Valeur numérique' },
  { key: 'checkbox',   label: 'Case à cocher', Icon: CheckSquare, bg: 'bg-emerald-100', fg: 'text-emerald-600', desc: 'Oui / Non' },
  { key: 'date',       label: 'Date',          Icon: Calendar,    bg: 'bg-amber-100',   fg: 'text-amber-600',   desc: 'Date' },
  { key: 'dropdown',   label: 'Liste déroul.', Icon: List,        bg: 'bg-indigo-100',  fg: 'text-indigo-600',  desc: 'Choix dans une liste' },
  { key: 'percentage', label: 'Pourcentage',   Icon: Percent,     bg: 'bg-violet-100',  fg: 'text-violet-600',  desc: 'Valeur en %' },
  { key: 'currency',   label: 'Devise (MAD)',  Icon: DollarSign,  bg: 'bg-green-100',   fg: 'text-green-600',   desc: 'Montant en dirhams' },
  { key: 'long_note',  label: 'Texte long',    Icon: AlignLeft,   bg: 'bg-slate-100',   fg: 'text-slate-500',   desc: 'Paragraphe multiligne' },
  { key: 'url',        label: 'URL',           Icon: Globe,       bg: 'bg-cyan-100',    fg: 'text-cyan-600',    desc: 'Lien web' },
  { key: 'stars',      label: 'Étoiles',       Icon: Star,        bg: 'bg-amber-100',   fg: 'text-amber-500',   desc: 'Note de 1 à 5' },
]
const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(t => [t.key, t]))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function useClickOutside(ref, fn) {
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) fn() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fn])
}

function isEmpty(type, value) {
  if (type === 'checkbox') return !value
  if (type === 'stars')    return value == null || value === 0
  return value == null || value === ''
}

// ─── Small coloured icon pill ─────────────────────────────────────────────────
function TypeIcon({ type }) {
  const ft = FIELD_TYPE_MAP[type]
  if (!ft) return null
  return (
    <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-md flex-shrink-0 ${ft.bg}`}>
      <ft.Icon size={11} className={ft.fg} />
    </span>
  )
}

// ─── "Saved" flash badge ──────────────────────────────────────────────────────
function SavedBadge({ show }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600
                  transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <Check size={10} strokeWidth={3} /> Enregistré
    </span>
  )
}

// ─── Field type picker grid ───────────────────────────────────────────────────
function TypePickerGrid({ onPick, exclude }) {
  return (
    <div className="grid grid-cols-2 gap-0.5 p-1">
      {FIELD_TYPES.map(ft => (
        <button
          key={ft.key}
          disabled={ft.key === exclude}
          onClick={() => onPick(ft.key)}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors
                      ${ft.key === exclude
                        ? 'opacity-30 cursor-default'
                        : 'hover:bg-slate-50 active:bg-slate-100'}`}
        >
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${ft.bg}`}>
            <ft.Icon size={14} className={ft.fg} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 leading-tight">{ft.label}</p>
            <p className="text-[10px] text-slate-400 leading-tight truncate">{ft.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Add field button (two-step flow: pick type → name) ──────────────────────
function AddFieldButton({ onAdd }) {
  const [step, setStep]         = useState(null)  // null | 'type' | 'name'
  const [chosenType, setChosen] = useState(null)
  const [name, setName]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [createError, setCreateError] = useState(null)
  const ref     = useRef(null)
  const inputRef = useRef(null)

  useClickOutside(ref, () => { setStep(null); setChosen(null); setName(''); setCreateError(null) })

  function pickType(key) {
    setChosen(key)
    setName(FIELD_TYPE_MAP[key]?.label ?? '')
    setStep('name')
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 40)
  }

  async function create() {
    if (!name.trim() || !chosenType || saving) return
    setSaving(true)
    setCreateError(null)
    const { data: max } = await supabase
      .from('custom_field_definitions')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({ name: name.trim(), type: chosenType, sort_order: (max?.sort_order ?? 0) + 1 })
      .select()
      .single()
    setSaving(false)
    if (error) {
      console.error('Field creation failed:', error)
      setCreateError(error.message ?? 'Erreur lors de la création du champ')
      return
    }
    if (data) {
      onAdd(data)
      setStep(null); setChosen(null); setName(''); setCreateError(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setStep(s => s ? null : 'type')}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-600
                   hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-colors"
      >
        <Plus size={13} />
        Ajouter un champ
      </button>

      {/* Step 1 – type grid */}
      {step === 'type' && (
        <div className="absolute right-0 top-full mt-1.5 w-[320px] bg-white rounded-xl
                        shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">
            Type de champ
          </p>
          <TypePickerGrid onPick={pickType} />
        </div>
      )}

      {/* Step 2 – name input */}
      {step === 'name' && chosenType && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl
                        shadow-2xl border border-slate-200 z-50 p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <TypeIcon type={chosenType} />
            <span className="text-xs font-semibold text-slate-600">Nom du champ</span>
            <button
              onClick={() => setStep('type')}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          </div>
          <input
            ref={inputRef}
            className="input text-sm py-1.5"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Budget, Décisionnaire…"
            onKeyDown={e => {
              if (e.key === 'Enter')  create()
              if (e.key === 'Escape') setStep('type')
            }}
          />
          {createError && (
            <p className="text-[11px] text-red-500 mt-1.5">{createError}</p>
          )}
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setStep('type')} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
              ← Retour
            </button>
            <button
              onClick={create}
              disabled={!name.trim() || saving}
              className="btn-primary text-xs py-1.5 flex-1 justify-center"
            >
              {saving ? '…' : 'Créer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dropdown options manager ─────────────────────────────────────────────────
function OptionsPanel({ def, onUpdate, onClose }) {
  const [options, setOptions] = useState(def.options ?? [])
  const [draft, setDraft]     = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')

  async function persist(next) {
    setOptions(next)
    await supabase.from('custom_field_definitions').update({ options: next }).eq('id', def.id)
    onUpdate({ ...def, options: next })
  }
  function add()           { if (!draft.trim()) return; persist([...options, draft.trim()]); setDraft('') }
  function remove(i)       { persist(options.filter((_, j) => j !== i)) }
  function commitEdit(i)   { if (!editVal.trim()) { setEditIdx(null); return }; persist(options.map((o, j) => j === i ? editVal.trim() : o)); setEditIdx(null) }

  return (
    <div className="mx-2 mb-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Settings2 size={11} /> Options
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
      </div>

      {options.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">Aucune option. Ajoutez-en ci-dessous.</p>
      )}

      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1 group">
            {editIdx === i ? (
              <input
                autoFocus
                className="input flex-1 py-1 text-xs"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => commitEdit(i)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(i); if (e.key === 'Escape') setEditIdx(null) }}
              />
            ) : (
              <button
                onClick={() => { setEditIdx(i); setEditVal(opt) }}
                className="flex-1 text-left text-xs px-2 py-1 rounded-lg hover:bg-white hover:shadow-sm
                           border border-transparent hover:border-slate-200 text-slate-700 transition-all"
              >
                {opt}
              </button>
            )}
            <button
              onClick={() => remove(i)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400
                         hover:text-red-500 transition-all flex-shrink-0"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          className="input flex-1 py-1 text-xs"
          placeholder="Nouvelle option…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={!draft.trim()} className="btn-primary text-xs px-2.5 py-1">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Inline field value editors ───────────────────────────────────────────────
function FieldValue({ def, value, onChange }) {
  const base = `text-sm text-slate-700 bg-transparent border-0 outline-none w-full min-w-0
                placeholder:text-slate-300
                focus:bg-white focus:rounded-md focus:px-2 focus:-mx-2 focus:py-0.5 focus:-my-0.5
                focus:shadow-sm focus:ring-1 focus:ring-slate-200 transition-all`

  switch (def.type) {
    case 'text':
      return (
        <input type="text" className={base} value={value ?? ''} placeholder="—"
          onChange={e => onChange(e.target.value || null)} />
      )

    case 'number':
      return (
        <input type="number" className={`${base} w-32`} value={value ?? ''} placeholder="—"
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      )

    case 'percentage': {
      const pct = Math.min(100, Math.max(0, value ?? 0))
      return (
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="number" min="0" max="100"
            className={`${base} w-14 flex-shrink-0`}
            value={value ?? ''} placeholder="0"
            onChange={e => onChange(e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))))}
          />
          <span className="text-xs text-slate-400 flex-shrink-0">%</span>
          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden min-w-[48px]">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-[width] duration-300"
              style={{ width: `${value != null ? pct : 0}%` }}
            />
          </div>
        </div>
      )
    }

    case 'currency':
      return (
        <div className="flex items-center gap-1.5">
          <input type="number" min="0" className={`${base} w-28`} value={value ?? ''} placeholder="0"
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
          <span className="text-xs font-semibold text-slate-400 flex-shrink-0">MAD</span>
        </div>
      )

    case 'checkbox':
      return (
        <button
          onClick={() => onChange(!value)}
          className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center
                      flex-shrink-0 transition-all duration-150
                      ${value ? 'bg-brand-600 border-brand-600' : 'border-slate-300 hover:border-brand-400 bg-white'}`}
        >
          {value && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>
      )

    case 'date':
      return (
        <input type="date" className={`${base} text-xs`} value={value ?? ''}
          onChange={e => onChange(e.target.value || null)} />
      )

    case 'dropdown':
      if (!def.options?.length)
        return <span className="text-xs text-slate-300 italic">Gérer les options via ···</span>
      return (
        <select className={`${base} cursor-pointer`} value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}>
          <option value="">—</option>
          {def.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )

    case 'long_note':
      return (
        <textarea
          className={`${base} resize-none leading-relaxed text-xs min-h-[52px]`}
          value={value ?? ''} placeholder="—" rows={3}
          onChange={e => onChange(e.target.value || null)}
        />
      )

    case 'url':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <input type="url" className={`${base} flex-1`} value={value ?? ''} placeholder="https://…"
            onChange={e => onChange(e.target.value || null)} />
          {value && (
            <a href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
               className="flex-shrink-0 text-brand-500 hover:text-brand-700 transition-colors">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )

    case 'stars':
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onChange(n === value ? null : n)}
                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95">
              <Star size={17}
                className={n <= (value ?? 0)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200 hover:text-amber-300 transition-colors'} />
            </button>
          ))}
          {value && (
            <button onClick={() => onChange(null)}
                    className="ml-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors leading-none">
              ×
            </button>
          )}
        </div>
      )

    default:
      return <span className="text-xs text-slate-300">—</span>
  }
}

// ─── ··· context menu ─────────────────────────────────────────────────────────
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
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl
                        border border-slate-200 z-50 py-1 min-w-[170px]">
          <MenuItem icon={Pencil}    label="Renommer"           onClick={() => { onRename();       setOpen(false) }} />
          <MenuItem icon={RefreshCw} label="Changer le type"    onClick={() => { onChangeType();   setOpen(false) }} />
          {def.type === 'dropdown' && (
            <MenuItem icon={Settings2} label="Gérer les options" onClick={() => { onManageOptions(); setOpen(false) }} />
          )}
          <div className="h-px bg-slate-100 my-1" />
          <MenuItem icon={Trash2} label="Supprimer" onClick={() => { onDelete(); setOpen(false) }} danger />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors
                  ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <Icon size={12} className={danger ? '' : 'text-slate-400'} />
      {label}
    </button>
  )
}

// ─── Sortable row wrapper ─────────────────────────────────────────────────────
function SortableRow({
  def, value, onChange,
  onRename, onChangeType, onManageOptions, onDelete,
  isRenaming, renameVal, setRenameVal, commitRename, cancelRename,
  isChangingType, onTypeSelect, onTypeClose,
  isManagingOptions,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex:   isDragging ? 20 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Main row */}
      <div className={`group flex items-start border-b border-slate-100 last:border-0
                        transition-colors hover:bg-slate-50/80
                        ${isDragging ? 'bg-white shadow-lg rounded-lg border border-slate-200' : ''}`}>

        {/* Drag handle */}
        <button
          {...attributes} {...listeners} tabIndex={-1}
          className="self-stretch px-1.5 flex items-center cursor-grab active:cursor-grabbing
                     opacity-0 group-hover:opacity-100 transition-opacity text-slate-300
                     hover:text-slate-500 focus:outline-none touch-none flex-shrink-0"
        >
          <GripVertical size={13} />
        </button>

        {/* Type icon (click → change type) + field name */}
        <div className="flex items-center gap-2 py-2.5 w-44 flex-shrink-0 min-w-0 pr-3">
          <div className="relative flex-shrink-0">
            <button onClick={onChangeType} title="Changer le type"
                    className="hover:opacity-70 transition-opacity">
              <TypeIcon type={def.type} />
            </button>
            {isChangingType && (
              <div className="absolute left-0 top-full mt-1.5 w-[320px] bg-white rounded-xl
                              shadow-2xl border border-slate-200 z-50 overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">
                  Changer le type
                </p>
                <TypePickerGrid onPick={onTypeSelect} exclude={def.type} />
                <div className="p-2 pt-1">
                  <button onClick={onTypeClose}
                          className="w-full text-xs text-center text-slate-400 hover:text-slate-600 py-1">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          {isRenaming ? (
            <input
              autoFocus
              className="text-xs font-medium text-slate-700 bg-white border border-brand-400
                         rounded-md px-1.5 py-0.5 w-full outline-none shadow-sm"
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
            />
          ) : (
            <button
              onClick={onRename}
              title="Cliquer pour renommer"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 truncate text-left
                         flex-1 min-w-0 transition-colors"
            >
              {def.name}
            </button>
          )}
        </div>

        {/* Value editor */}
        <div className="flex-1 py-2.5 pr-2 min-w-0">
          <FieldValue def={def} value={value ?? (def.type === 'checkbox' ? false : null)} onChange={onChange} />
        </div>

        {/* ··· menu */}
        <div className="py-2 pr-1.5 self-start mt-0.5 flex-shrink-0">
          <RowMenu
            def={def}
            onRename={onRename}
            onChangeType={onChangeType}
            onManageOptions={onManageOptions}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Inline dropdown options panel */}
      {isManagingOptions && (
        <OptionsPanel
          def={def}
          onUpdate={updated => onManageOptions('save', updated)}
          onClose={() => onManageOptions('close')}
        />
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ChampsSection({ fieldDefs, setFieldDefs, customFields, onChange }) {
  const [showEmpty,      setShowEmpty]      = useState(false)
  const [renamingId,     setRenamingId]     = useState(null)
  const [renameVal,      setRenameVal]      = useState('')
  const [changeTypeId,   setChangeTypeId]   = useState(null)
  const [optionsMgmtId,  setOptionsMgmtId]  = useState(null)
  const [saved,          setSaved]          = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor,    { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor,   { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2200) }

  // ── Show / hide ─────────────────────────────────────────────────────────────
  const emptyCount = fieldDefs.filter(d => isEmpty(d.type, customFields[d.id])).length
  const displayed  = showEmpty ? fieldDefs : fieldDefs.filter(d => !isEmpty(d.type, customFields[d.id]))

  // ── Rename ──────────────────────────────────────────────────────────────────
  function startRename(def) { setRenamingId(def.id); setRenameVal(def.name) }

  async function commitRename() {
    const def = fieldDefs.find(d => d.id === renamingId)
    setRenamingId(null)
    if (!def) return
    const name = renameVal.trim()
    if (!name || name === def.name) return
    await supabase.from('custom_field_definitions').update({ name }).eq('id', def.id)
    setFieldDefs(ds => ds.map(d => d.id === def.id ? { ...d, name } : d))
    flash()
  }

  // ── Change type ─────────────────────────────────────────────────────────────
  async function handleTypeSelect(defId, newType) {
    setChangeTypeId(null)
    await supabase.from('custom_field_definitions').update({ type: newType }).eq('id', defId)
    setFieldDefs(ds => ds.map(d => d.id === defId ? { ...d, type: newType } : d))
    onChange({ ...customFields, [defId]: null })
    flash()
  }

  // ── Options management ──────────────────────────────────────────────────────
  function handleOptions(defId, action, payload) {
    if (action === 'open')  { setOptionsMgmtId(defId); return }
    if (action === 'close') { setOptionsMgmtId(null);  return }
    if (action === 'save')  {
      setFieldDefs(ds => ds.map(d => d.id === defId ? payload : d))
      setOptionsMgmtId(null)
      flash()
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(defId) {
    if (!confirm('Supprimer ce champ ? Les valeurs seront perdues pour tous les prospects.')) return
    await supabase.from('custom_field_definitions').delete().eq('id', defId)
    setFieldDefs(ds => ds.filter(d => d.id !== defId))
    const next = { ...customFields }; delete next[defId]
    onChange(next)
    flash()
  }

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────
  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = fieldDefs.findIndex(d => d.id === active.id)
    const to   = fieldDefs.findIndex(d => d.id === over.id)
    const next = arrayMove(fieldDefs, from, to)
    setFieldDefs(next)
    await Promise.all(next.map((d, i) =>
      supabase.from('custom_field_definitions').update({ sort_order: i }).eq('id', d.id)
    ))
    flash()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mt-6">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Champs</h3>
        <SavedBadge show={saved} />
        <div className="ml-auto flex items-center gap-1">
          {emptyCount > 0 && (
            <button
              onClick={() => setShowEmpty(v => !v)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600
                         px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors font-medium"
            >
              {showEmpty
                ? <><EyeOff size={11} /> Masquer vides ({emptyCount})</>
                : <><Eye size={11} /> Afficher vides ({emptyCount})</>}
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

      {/* Empty state — no fields defined yet */}
      {fieldDefs.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 px-4 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 mb-3">
            <Plus size={18} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-0.5">Aucun champ personnalisé</p>
          <p className="text-xs text-slate-400">
            Cliquez sur <strong className="text-slate-500">Ajouter un champ</strong> pour commencer.
          </p>
        </div>
      )}

      {/* Field list */}
      {fieldDefs.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
          {displayed.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-5">
              {emptyCount} champ{emptyCount > 1 ? 's' : ''} vide{emptyCount > 1 ? 's' : ''} — cliquez « Afficher vides ».
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayed.map(d => d.id)} strategy={verticalListSortingStrategy}>
                {displayed.map(def => (
                  <SortableRow
                    key={def.id}
                    def={def}
                    value={customFields[def.id]}
                    onChange={val => onChange({ ...customFields, [def.id]: val })}
                    onRename={() => startRename(def)}
                    onChangeType={() => setChangeTypeId(id => id === def.id ? null : def.id)}
                    onTypeSelect={type => handleTypeSelect(def.id, type)}
                    onTypeClose={() => setChangeTypeId(null)}
                    onManageOptions={(action, payload) => handleOptions(def.id, action, payload)}
                    onDelete={() => handleDelete(def.id)}
                    isRenaming={renamingId === def.id}
                    renameVal={renameVal}
                    setRenameVal={setRenameVal}
                    commitRename={commitRename}
                    cancelRename={() => setRenamingId(null)}
                    isChangingType={changeTypeId === def.id}
                    isManagingOptions={optionsMgmtId === def.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

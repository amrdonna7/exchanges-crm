import { useState } from 'react'
import { X, Trash2, Loader2, Plus, GripVertical, Check, Pencil } from 'lucide-react'
import { usePipelines } from '../contexts/PipelineContext'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableStageRow({ stage, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(stage.name)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })

  function commit() {
    setEditing(false)
    if (val.trim() && val.trim() !== stage.name) onRename(stage.id, val.trim())
    else setVal(stage.name)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 group"
    >
      <button {...attributes} {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical size={14} />
      </button>
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color ?? '#6366f1' }} />
      {editing ? (
        <input
          autoFocus
          className="flex-1 text-sm border-0 outline-none bg-transparent"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(stage.name); setEditing(false) } }}
        />
      ) : (
        <span className="flex-1 text-sm text-slate-700">{stage.name}</span>
      )}
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
        <Pencil size={12} />
      </button>
      <button onClick={() => onDelete(stage.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export default function PipelineSettingsModal({ pipelineId, onClose }) {
  const { pipelines, stagesMap, updatePipeline, deletePipeline, addStage, updateStage, deleteStage, reorderStages } = usePipelines()
  const navigate = useNavigate()
  const pipeline = pipelines.find(p => p.id === pipelineId)
  const stages   = stagesMap[pipelineId] ?? []

  const [name, setName]         = useState(pipeline?.name ?? '')
  const [saving, setSaving]     = useState(false)
  const [newStage, setNewStage] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function saveName() {
    if (!name.trim() || name.trim() === pipeline?.name) return
    setSaving(true)
    await updatePipeline(pipelineId, { name: name.trim() })
    setSaving(false)
  }

  async function handleAddStage() {
    if (!newStage.trim()) return
    await addStage(pipelineId, newStage.trim())
    setNewStage('')
  }

  async function handleDeletePipeline() {
    if (!confirm(`Delete pipeline "${pipeline?.name}"? This will also delete all leads in it.`)) return
    await deletePipeline(pipelineId)
    navigate('/dashboard')
    onClose()
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = stages.findIndex(s => s.id === active.id)
    const to   = stages.findIndex(s => s.id === over.id)
    reorderStages(pipelineId, arrayMove(stages, from, to))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Pipeline Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pipeline Name</label>
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()} />
              <button onClick={saveName} disabled={saving || !name.trim()}
                className="btn-primary text-xs px-3">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
            </div>
          </div>

          {/* Stages */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Stages</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 mb-2">
                  {stages.map(s => (
                    <SortableStageRow
                      key={s.id}
                      stage={s}
                      onRename={(id, name) => updateStage(id, { name })}
                      onDelete={id => {
                        if (confirm('Delete this stage? Leads in it will become uncategorized.'))
                          deleteStage(id)
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex gap-1.5 mt-2">
              <input
                className="input flex-1 text-sm py-1.5"
                placeholder="New stage name…"
                value={newStage}
                onChange={e => setNewStage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStage()}
              />
              <button onClick={handleAddStage} disabled={!newStage.trim()}
                className="btn-primary text-xs px-3">
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border border-red-100 rounded-xl p-4">
            <p className="text-xs font-bold text-red-600 mb-2">Danger Zone</p>
            <button
              onClick={handleDeletePipeline}
              className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:bg-red-50
                         px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Delete this pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

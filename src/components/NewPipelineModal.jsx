import { useState } from 'react'
import { X, Plus, Trash2, Loader2, GripVertical } from 'lucide-react'
import { usePipelines } from '../contexts/PipelineContext'
import { useNavigate } from 'react-router-dom'

const DEFAULT_STAGE_NAMES = [
  'Qualified Lead', 'Contact Made', 'Proposal Sent', 'Negotiation', 'Won', 'Lost',
]

export default function NewPipelineModal({ onClose, pipeline = null }) {
  const { createPipeline, updatePipeline } = usePipelines()
  const navigate = useNavigate()
  const [name, setName]         = useState(pipeline?.name ?? '')
  const [description, setDesc]  = useState(pipeline?.description ?? '')
  const [stages, setStages]     = useState(
    pipeline ? [] : DEFAULT_STAGE_NAMES.map(n => ({ name: n }))
  )
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function addStage()         { setStages(s => [...s, { name: '' }]) }
  function removeStage(i)     { setStages(s => s.filter((_, j) => j !== i)) }
  function renameStage(i, v)  { setStages(s => s.map((st, j) => j === i ? { ...st, name: v } : st)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Pipeline name is required'); return }
    setSaving(true)
    if (pipeline) {
      await updatePipeline(pipeline.id, { name: name.trim(), description: description.trim() })
      onClose()
    } else {
      const stageNames = stages.map(s => s.name.trim()).filter(Boolean)
      const pl = await createPipeline(name.trim(), description.trim(), stageNames)
      if (pl) { onClose(); navigate(`/pipeline/${pl.id}`) }
      else setError('Failed to create pipeline')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{pipeline ? 'Edit Pipeline' : 'New Pipeline'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pipeline Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. School Prospecting" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
            <input className="input" value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional description" />
          </div>

          {!pipeline && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Stages</label>
              <div className="space-y-1.5 mb-2">
                {stages.map((st, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1 text-sm py-1.5"
                      value={st.name}
                      onChange={e => renameStage(i, e.target.value)}
                      placeholder={`Stage ${i + 1}`}
                    />
                    <button type="button" onClick={() => removeStage(i)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addStage}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                <Plus size={13} /> Add Stage
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-sm">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {pipeline ? 'Save Changes' : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

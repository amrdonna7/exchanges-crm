import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PipelineContext = createContext(null)

const DEFAULT_STAGES = [
  { name: 'Qualified Lead',  color: '#94a3b8', sort_order: 0 },
  { name: 'Contact Made',    color: '#3b82f6', sort_order: 1 },
  { name: 'Site Visit',      color: '#f59e0b', sort_order: 2 },
  { name: 'Proposal Sent',   color: '#6366f1', sort_order: 3 },
  { name: 'Negotiation',     color: '#f97316', sort_order: 4 },
  { name: 'Won',             color: '#10b981', sort_order: 5 },
  { name: 'Lost',            color: '#ef4444', sort_order: 6 },
]

export function PipelineProvider({ children }) {
  const { user } = useAuth()
  const [pipelines, setPipelines]   = useState([])
  const [stagesMap, setStagesMap]   = useState({})   // pipelineId -> stage[]
  const [loading, setLoading]       = useState(true)
  const [bootstrapped, setBootstrapped] = useState(false)

  const loadAll = useCallback(async () => {
    const [{ data: pls }, { data: stgs }] = await Promise.all([
      supabase.from('pipelines').select('*').order('created_at'),
      supabase.from('pipeline_stages').select('*').order('sort_order'),
    ])
    const pipelinesData = pls ?? []
    const stagesData = stgs ?? []

    // Group stages by pipeline_id
    const map = {}
    for (const s of stagesData) {
      if (!map[s.pipeline_id]) map[s.pipeline_id] = []
      map[s.pipeline_id].push(s)
    }

    setPipelines(pipelinesData)
    setStagesMap(map)
    setLoading(false)
    return { pipelines: pipelinesData, stagesMap: map }
  }, [])

  useEffect(() => {
    if (!user || bootstrapped) return
    async function boot() {
      const { pipelines: pls } = await loadAll()
      if (pls.length === 0) {
        // Bootstrap: create default pipeline
        const { data: newPipeline } = await supabase
          .from('pipelines')
          .insert({ name: 'School Prospecting', description: 'Default pipeline', created_by: user.id })
          .select().single()
        if (newPipeline) {
          const stageInserts = DEFAULT_STAGES.map(s => ({ ...s, pipeline_id: newPipeline.id }))
          await supabase.from('pipeline_stages').insert(stageInserts)
          // Assign all existing leads to this pipeline
          await supabase.from('leads').update({ pipeline_id: newPipeline.id }).is('pipeline_id', null)
          await loadAll()
        }
      } else {
        // Assign orphaned leads to first pipeline
        await supabase.from('leads').update({ pipeline_id: pls[0].id }).is('pipeline_id', null)
      }
      setBootstrapped(true)
    }
    boot()
  }, [user, bootstrapped, loadAll])

  async function createPipeline(name, description, stageNames) {
    const { data: pl } = await supabase
      .from('pipelines')
      .insert({ name, description, created_by: user?.id })
      .select().single()
    if (!pl) return null
    if (stageNames?.length) {
      await supabase.from('pipeline_stages').insert(
        stageNames.map((n, i) => ({ pipeline_id: pl.id, name: n, sort_order: i }))
      )
    }
    await loadAll()
    return pl
  }

  async function updatePipeline(id, updates) {
    await supabase.from('pipelines').update(updates).eq('id', id)
    await loadAll()
  }

  async function deletePipeline(id) {
    await supabase.from('pipelines').delete().eq('id', id)
    await loadAll()
  }

  async function addStage(pipelineId, name, color = '#6366f1') {
    const existing = stagesMap[pipelineId] ?? []
    const sort_order = existing.length
    const { data } = await supabase
      .from('pipeline_stages')
      .insert({ pipeline_id: pipelineId, name, color, sort_order })
      .select().single()
    await loadAll()
    return data
  }

  async function updateStage(id, updates) {
    await supabase.from('pipeline_stages').update(updates).eq('id', id)
    await loadAll()
  }

  async function deleteStage(id) {
    await supabase.from('pipeline_stages').delete().eq('id', id)
    await loadAll()
  }

  async function reorderStages(pipelineId, orderedStages) {
    setStagesMap(m => ({ ...m, [pipelineId]: orderedStages }))
    await Promise.all(orderedStages.map((s, i) =>
      supabase.from('pipeline_stages').update({ sort_order: i }).eq('id', s.id)
    ))
    await loadAll()
  }

  return (
    <PipelineContext.Provider value={{
      pipelines, stagesMap, loading, bootstrapped,
      loadAll, createPipeline, updatePipeline, deletePipeline,
      addStage, updateStage, deleteStage, reorderStages,
    }}>
      {children}
    </PipelineContext.Provider>
  )
}

export const usePipelines = () => useContext(PipelineContext)

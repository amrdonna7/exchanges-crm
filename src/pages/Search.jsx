import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Building2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGE_MAP, LEAD_TYPES } from '../lib/constants'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setSearched(false); return }
    performSearch(debouncedQuery.trim())
  }, [debouncedQuery])

  async function performSearch(q) {
    setLoading(true)
    setSearched(true)
    const term = `%${q}%`
    const { data } = await supabase
      .from('leads')
      .select('*')
      .or(`name.ilike.${term},contact_person.ilike.${term},email.ilike.${term},phone.ilike.${term},city.ilike.${term},notes.ilike.${term}`)
      .order('updated_at', { ascending: false })
      .limit(50)
    setResults(data ?? [])
    setLoading(false)
  }

  function highlight(text, q) {
    if (!text || !q) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{part}</mark> : part
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto overflow-y-auto h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Recherche</h1>
        <p className="text-slate-500 text-sm mt-0.5">Recherchez dans tous les prospects</p>
      </div>

      <div className="relative mb-6">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          className="w-full pl-11 pr-10 py-3 text-base bg-white border border-slate-200 rounded-xl
                     shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                     placeholder:text-slate-400 transition"
          placeholder="Nom, email, téléphone, ville…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <SearchIcon size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun résultat pour « {query} »</p>
          <p className="text-slate-400 text-sm mt-1">Essayez un autre mot-clé</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium mb-3">
            {results.length} résultat{results.length > 1 ? 's' : ''} pour « {debouncedQuery} »
          </p>
          {results.map(lead => {
            const stage = STAGE_MAP[lead.stage]
            const type = LEAD_TYPES.find(t => t.id === lead.type)
            return (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="card p-4 flex items-start gap-4 hover:border-brand-200 hover:shadow-md transition-all group block"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 transition-colors">
                  <Building2 size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
                    {highlight(lead.name, debouncedQuery)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                    {lead.contact_person && <span>{highlight(lead.contact_person, debouncedQuery)}</span>}
                    {lead.city && <span>📍 {highlight(lead.city, debouncedQuery)}</span>}
                    {lead.email && <span>{highlight(lead.email, debouncedQuery)}</span>}
                    {lead.phone && <span>{highlight(lead.phone, debouncedQuery)}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {stage && <span className={`badge ${stage.color}`}>{stage.label}</span>}
                  {type && <span className="badge bg-slate-100 text-slate-600">{type.label}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && !searched && (
        <div className="text-center py-16">
          <SearchIcon size={48} className="text-slate-100 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Commencez à taper pour chercher</p>
        </div>
      )}
    </div>
  )
}

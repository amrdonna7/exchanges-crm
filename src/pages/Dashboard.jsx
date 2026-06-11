import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Users, Trophy, AlertCircle, Clock, ArrowRight, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { usePipelines } from '../contexts/PipelineContext'

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { pipelines, stagesMap } = usePipelines()
  const [leads, setLeads]        = useState([])
  const [activities, setActivities] = useState([])
  const [profiles, setProfiles]  = useState([])
  const [loading, setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: leadsData }, { data: actData }, { data: profData }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('activities')
          .select('*, lead:leads(name), user:profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('profiles').select('id, full_name, email'),
      ])
      setLeads(leadsData ?? [])
      setActivities(actData ?? [])
      setProfiles(profData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const total   = leads.length
  const active  = leads.filter(l => l.stage && !['Lost', 'Won'].includes(
    Object.values(stagesMap).flat().find(s => s.id === l.stage)?.name ?? ''
  )).length
  const won     = leads.filter(l => {
    const stageName = Object.values(stagesMap).flat().find(s => s.id === l.stage)?.name ?? ''
    return stageName === 'Won' || stageName === 'Conclu'
  }).length
  const lost = leads.filter(l => {
    const stageName = Object.values(stagesMap).flat().find(s => s.id === l.stage)?.name ?? ''
    return stageName === 'Lost' || stageName === 'Non Conclu'
  }).length
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0

  // Bar chart: leads per stage per pipeline (first pipeline shown)
  const barData = pipelines.map(pl => {
    const plStages = stagesMap[pl.id] ?? []
    const plLeads  = leads.filter(l => l.pipeline_id === pl.id)
    const entry = { pipeline: pl.name.length > 12 ? pl.name.slice(0, 12) + '…' : pl.name }
    for (const s of plStages) {
      entry[s.name] = plLeads.filter(l => l.stage === s.id).length
    }
    entry.total = plLeads.length
    return entry
  })

  // Pie chart: leads by assignee
  const userLeadMap = {}
  for (const l of leads) {
    const key = l.assigned_to ?? 'Unassigned'
    userLeadMap[key] = (userLeadMap[key] ?? 0) + 1
  }
  const pieData = Object.entries(userLeadMap).map(([userId, count]) => {
    const prof = profiles.find(p => p.id === userId)
    return { name: prof?.full_name ?? prof?.email ?? 'Unassigned', value: count }
  })

  // Activity over time (last 14 days)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  const actByDay = {}
  for (const a of activities) {
    const day = a.created_at?.slice(0, 10)
    if (day) actByDay[day] = (actByDay[day] ?? 0) + 1
  }
  const lineData = last14.map(day => ({
    date: day.slice(5),
    activities: actByDay[day] ?? 0,
  }))

  // Pipeline summary
  const pipelineSummary = pipelines.map(pl => ({
    name: pl.name,
    total: leads.filter(l => l.pipeline_id === pl.id).length,
    won:   leads.filter(l => {
      if (l.pipeline_id !== pl.id) return false
      const sn = (stagesMap[pl.id] ?? []).find(s => s.id === l.stage)?.name ?? ''
      return sn === 'Won' || sn === 'Conclu'
    }).length,
  }))

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Overview across all pipelines</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Leads"    value={total}    icon={Users}      color="bg-blue-50 text-blue-600" />
            <StatCard label="Active"         value={active}   icon={TrendingUp} color="bg-violet-50 text-violet-600" sub="In pipeline" />
            <StatCard label="Won"            value={won}      icon={Trophy}     color="bg-emerald-50 text-emerald-600" sub={`${winRate}% win rate`} />
            <StatCard label="Lost"           value={lost}     icon={AlertCircle} color="bg-red-50 text-red-600" />
          </div>

          {/* Pipeline summary cards */}
          {pipelineSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelineSummary.map(pl => (
                <div key={pl.name} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-700 text-sm truncate">{pl.name}</p>
                    <Link to={`/pipeline/${pipelines.find(p => p.name === pl.name)?.id}`}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                      View <ArrowRight size={11} />
                    </Link>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{pl.total}</p>
                  <p className="text-xs text-slate-400">{pl.won} won</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Leads by pipeline bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 mb-4 text-sm">Leads per Pipeline</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="pipeline" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Leads by assignee pie chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 mb-4 text-sm">Leads by Assignee</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={75}
                         dataKey="value" nameKey="name" label={({ name, percent }) =>
                           `${name.split(' ')[0]} ${Math.round(percent * 100)}%`}
                         labelLine={false} fontSize={11}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">
                  No data yet
                </div>
              )}
            </div>
          </div>

          {/* Activity line chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Activity (Last 14 Days)</h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={lineData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="activities" stroke="#6366f1" strokeWidth={2}
                      dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Recent Activity</h2>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 10).map(act => (
                  <div key={act.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-base mt-0.5 flex-shrink-0">
                      {{ note:'📝', stage_change:'🔄', field_update:'✏️', call:'📞', email:'📧', meeting:'🤝' }[act.type] ?? '📋'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">{act.user?.full_name ?? act.user?.email ?? 'Unknown'}</span>
                        {' — '}
                        <Link to={`/leads/${act.lead_id}`} className="text-brand-600 hover:underline">
                          {act.lead?.name ?? 'Lead'}
                        </Link>
                      </p>
                      {act.content && <p className="text-xs text-slate-500 mt-0.5 truncate">{act.content}</p>}
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(act.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

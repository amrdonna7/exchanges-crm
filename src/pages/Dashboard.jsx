import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Users, Trophy, AlertCircle, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGES, STAGE_MAP, ACTIVITY_ICONS } from '../lib/constants'

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card p-5 flex items-start gap-4">
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
  const [leads, setLeads] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: leadsData }, { data: actData }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase
          .from('activities')
          .select('*, lead:leads(organization_name), user:profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(15),
      ])
      setLeads(leadsData ?? [])
      setActivities(actData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const countByStage = stage => leads.filter(l => l.stage === stage).length
  const total = leads.length
  const won = countByStage('won')
  const lost = countByStage('lost')
  const active = leads.filter(l => !['won', 'lost'].includes(l.stage)).length
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Overview of your sales pipeline</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Leads" value={total} icon={Users}
              color="bg-blue-50 text-blue-600" />
            <StatCard label="Active" value={active} sub="In pipeline" icon={TrendingUp}
              color="bg-violet-50 text-violet-600" />
            <StatCard label="Won" value={won} sub={`${winRate}% win rate`} icon={Trophy}
              color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Lost" value={lost} icon={AlertCircle}
              color="bg-red-50 text-red-600" />
          </div>

          {/* Stage breakdown */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-800 mb-5">Pipeline by Stage</h2>
            <div className="space-y-3">
              {STAGES.map(stage => {
                const count = countByStage(stage.id)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-36 flex-shrink-0">
                      <span className={`badge ${stage.color}`}>{stage.label}</span>
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${stage.dot}`}
                        style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Recent Activity</h2>
              <Link to="/pipeline" className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1">
                View pipeline <ArrowRight size={12} />
              </Link>
            </div>

            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-base mt-0.5">{ACTIVITY_ICONS[act.type] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">{act.user?.full_name ?? act.user?.email ?? 'Unknown'}</span>
                        {' '}—{' '}
                        <Link to={`/leads/${act.lead_id}`} className="text-brand-600 hover:underline">
                          {act.lead?.organization_name ?? 'Lead'}
                        </Link>
                      </p>
                      {act.content && <p className="text-xs text-slate-500 mt-0.5 truncate">{act.content}</p>}
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(act.created_at).toLocaleDateString()}
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

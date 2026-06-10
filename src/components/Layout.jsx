import { useState } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, LogOut, Menu, X,
  Plus, ChevronRight, Settings, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePipelines } from '../contexts/PipelineContext'
import NewPipelineModal from './NewPipelineModal'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const { pipelines, loading: plLoading } = usePipelines()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [showNewPipeline, setShowNewPipeline] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen overflow-hidden">
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-60 bg-brand-900 flex flex-col
                    transition-transform duration-200
                    ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-brand-800 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">E</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Exchanges CRM</span>
          <button className="ml-auto lg:hidden text-brand-300" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
               ${isActive ? 'bg-brand-700 text-white' : 'text-brand-200 hover:bg-brand-800 hover:text-white'}`
            }
          >
            <LayoutDashboard size={15} />
            Dashboard
          </NavLink>

          {/* Pipelines section */}
          <div className="pt-3 pb-1">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Pipelines</span>
              <button
                onClick={() => setShowNewPipeline(true)}
                className="text-brand-400 hover:text-white transition-colors p-0.5 rounded"
                title="New pipeline"
              >
                <Plus size={13} />
              </button>
            </div>

            {plLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 size={14} className="text-brand-400 animate-spin" />
              </div>
            ) : (
              pipelines.map(pl => (
                <NavLink
                  key={pl.id}
                  to={`/pipeline/${pl.id}`}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                     ${isActive ? 'bg-brand-700 text-white' : 'text-brand-300 hover:bg-brand-800 hover:text-white'}`
                  }
                >
                  <KanbanSquare size={13} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{pl.name}</span>
                </NavLink>
              ))
            )}
          </div>
        </nav>

        {/* User */}
        <div className="p-2 border-t border-brand-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {profile?.full_name ?? profile?.email}
              </p>
              <p className="text-brand-300 text-[10px] truncate capitalize">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-brand-300 text-xs rounded-lg
                       hover:bg-brand-800 hover:text-white transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="text-slate-600">
            <Menu size={18} />
          </button>
          <span className="font-bold text-brand-700 text-sm">Exchanges CRM</span>
        </header>
        <main className="flex-1 overflow-hidden bg-slate-50">
          {children}
        </main>
      </div>

      {showNewPipeline && (
        <NewPipelineModal onClose={() => setShowNewPipeline(false)} />
      )}
    </div>
  )
}

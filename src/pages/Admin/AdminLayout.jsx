import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AdminLayout({ children, title }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.admin_role === 'admin'

  const nav = [
    { to: '/admin',             label: '📊 Dashboard',      exact: true },
    { to: '/admin/utilisateurs',label: '👥 Utilisateurs'               },
    { to: '/admin/annonces',    label: '📋 Annonces'                   },
    { to: '/admin/cours',       label: '📈 Cours marché'               },
    ...(isAdmin ? [{ to: '/admin/assistants', label: '🛡️ Assistants' }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 text-xl">←</button>
          <div>
            <span className="font-bold text-sm">KOURTI Admin</span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
              isAdmin ? 'bg-red-600 text-white' : 'bg-yellow-500 text-gray-900'
            }`}>
              {isAdmin ? 'Admin' : 'Assistant'}
            </span>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-white">
          Déconnexion
        </button>
      </div>

      {/* Nav tabs */}
      <div className="bg-gray-800 px-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max py-1">
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto">
        {title && (
          <div className="px-4 pt-5 pb-2">
            <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

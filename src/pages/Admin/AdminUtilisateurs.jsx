import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from './AdminLayout'

const ROLES_LABEL = { eleveur: 'Éleveur', acheteur: 'Acheteur', both: 'Les deux' }

export default function AdminUtilisateurs() {
  const { profile: moi } = useAuth()
  const [users, setUsers]       = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [actionId, setActionId] = useState(null)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, phone, prenom, nom, role, wilaya, badge, suspendu, admin_role, created_at, nb_transactions')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const toggleSuspend = async (user) => {
    setActionId(user.id)
    await supabase
      .from('users')
      .update({ suspendu: !user.suspendu })
      .eq('id', user.id)
    await loadUsers()
    setActionId(null)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      !q ||
      u.phone?.toLowerCase().includes(q) ||
      u.prenom?.toLowerCase().includes(q) ||
      u.nom?.toLowerCase().includes(q) ||
      u.wilaya?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminLayout title="Utilisateurs">
      <div className="px-4 py-4 space-y-4">

        {/* Recherche */}
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone, wilaya..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />

        {loading ? (
          <div className="text-center py-20 text-gray-400">Chargement...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <div
                key={u.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                  u.suspendu ? 'border-red-400' : u.admin_role ? 'border-yellow-400' : 'border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">
                      {u.prenom || '—'} {u.nom || ''}
                      {u.admin_role && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                          {u.admin_role === 'admin' ? 'Admin' : 'Assistant'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{u.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {u.role && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {ROLES_LABEL[u.role] || u.role}
                        </span>
                      )}
                      {u.wilaya && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          W. {u.wilaya}
                        </span>
                      )}
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                        {u.nb_transactions || 0} transac.
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {u.id !== moi?.id && (
                    <button
                      onClick={() => toggleSuspend(u)}
                      disabled={actionId === u.id}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
                        u.suspendu
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      } disabled:opacity-50`}
                    >
                      {actionId === u.id ? '...' : u.suspendu ? 'Réactiver' : 'Suspendre'}
                    </button>
                  )}
                </div>

                {u.suspendu && (
                  <p className="text-xs text-red-500 mt-2 font-medium">⛔ Compte suspendu</p>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">Aucun résultat</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

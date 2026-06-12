import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import AdminLayout from './AdminLayout'

function StatCard({ label, value, color = 'text-gray-800', sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    const [
      { count: nbUsers },
      { count: nbEleveurs },
      { count: nbAcheteurs },
      { count: nbAnnonces },
      { count: nbAnnoncesActives },
      { count: nbTransactions },
      { count: nbSuspendus },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'eleveur'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'acheteur'),
      supabase.from('annonces').select('*', { count: 'exact', head: true }),
      supabase.from('annonces').select('*', { count: 'exact', head: true }).eq('statut', 'active'),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('suspendu', true),
    ])

    setStats({ nbUsers, nbEleveurs, nbAcheteurs, nbAnnonces, nbAnnoncesActives, nbTransactions, nbSuspendus })
    setLoading(false)
  }

  return (
    <AdminLayout title="Dashboard">
      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement...</div>
      ) : (
        <div className="px-4 py-4 space-y-6">

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Utilisateurs</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total inscrits" value={stats.nbUsers} color="text-gray-900" />
              <StatCard label="Suspendus" value={stats.nbSuspendus} color="text-red-500" />
              <StatCard label="Éleveurs" value={stats.nbEleveurs} color="text-green-700" />
              <StatCard label="Acheteurs" value={stats.nbAcheteurs} color="text-blue-600" />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Marché</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Annonces actives"
                value={stats.nbAnnoncesActives}
                color="text-kourti-orange"
                sub={`/ ${stats.nbAnnonces} total`}
              />
              <StatCard label="Transactions" value={stats.nbTransactions} color="text-purple-600" />
            </div>
          </div>

          <button
            onClick={loadStats}
            className="w-full py-3 bg-gray-800 text-white rounded-2xl text-sm font-semibold"
          >
            Actualiser
          </button>
        </div>
      )}
    </AdminLayout>
  )
}

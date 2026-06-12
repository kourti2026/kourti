import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import AdminLayout from './AdminLayout'

const STATUTS = ['', 'active', 'suspendue', 'vendue', 'cloturee_65j']
const STATUTS_LABEL = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  suspendue: { label: 'Suspendue', color: 'bg-red-100 text-red-600' },
  vendue: { label: 'Vendue', color: 'bg-gray-100 text-gray-500' },
  cloturee_65j: { label: 'Clôturée', color: 'bg-gray-100 text-gray-400' },
}

export default function AdminAnnonces() {
  const [annonces, setAnnonces]   = useState([])
  const [filtre, setFiltre]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [actionId, setActionId]   = useState(null)

  useEffect(() => { loadAnnonces() }, [filtre])

  const loadAnnonces = async () => {
    setLoading(true)
    let q = supabase
      .from('annonces')
      .select('id, wilaya, commune, nb_sujets_initial, nb_sujets_restants, poids_moyen, statut, created_at, eleveur_id, users(prenom, nom, phone)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filtre) q = q.eq('statut', filtre)
    const { data } = await q
    setAnnonces(data || [])
    setLoading(false)
  }

  const changerStatut = async (id, statut) => {
    setActionId(id)
    await supabase.from('annonces').update({ statut }).eq('id', id)
    await loadAnnonces()
    setActionId(null)
  }

  const fmt = (d) => new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <AdminLayout title="Annonces">
      <div className="px-4 py-4 space-y-4">

        {/* Filtre statut */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUTS.map(s => (
            <button
              key={s}
              onClick={() => setFiltre(s)}
              className={`text-xs px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                filtre === s
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {s === '' ? 'Tout' : STATUTS_LABEL[s]?.label || s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Chargement...</div>
        ) : (
          <div className="space-y-3">
            {annonces.map(a => {
              const st = STATUTS_LABEL[a.statut] || { label: a.statut, color: 'bg-gray-100 text-gray-500' }
              return (
                <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        W. {a.wilaya} — {a.commune}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.nb_sujets_restants}/{a.nb_sujets_initial} sujets · {a.poids_moyen} kg · {fmt(a.created_at)}
                      </p>
                      {a.users && (
                        <p className="text-xs text-gray-400 mt-1">
                          {a.users.prenom} {a.users.nom} · {a.users.phone}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${st.color}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap mt-3">
                    {a.statut === 'active' && (
                      <button
                        onClick={() => changerStatut(a.id, 'suspendue')}
                        disabled={actionId === a.id}
                        className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-medium hover:bg-red-200 disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                    {a.statut === 'suspendue' && (
                      <button
                        onClick={() => changerStatut(a.id, 'active')}
                        disabled={actionId === a.id}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-xl font-medium hover:bg-green-200 disabled:opacity-50"
                      >
                        Réactiver
                      </button>
                    )}
                    {(a.statut === 'active' || a.statut === 'suspendue') && (
                      <button
                        onClick={() => changerStatut(a.id, 'cloturee_65j')}
                        disabled={actionId === a.id}
                        className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50"
                      >
                        Clôturer
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {annonces.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">Aucune annonce</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import { calcSerie, formatDA, icColor } from '../../lib/serieUtils'

export default function ElevageHub() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [serie,    setSerie]    = useState(null)
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Mon Élevage', pasSerie: 'Aucune série en cours',
      pasDes: 'Démarrez votre première série pour suivre votre élevage au quotidien.',
      nouvelle: 'Démarrer une série', hangar: 'Configurer mon hangar',
      enCours: 'Série en cours', age: 'Âge', vivants: 'Vivants',
      mortalite: 'Mortalité', poids: 'Poids moy.', ic: 'IC', ipe: 'IPE',
      tableau: 'Tableau de bord', saisir: 'Saisie du jour',
      vaccins: 'Calendrier vaccinal', vente: 'Vente partielle',
      joursRestants: 'jours avant vente prévue',
    },
    ar: {
      titre: 'مزرعتي', pasSerie: 'لا توجد سيري جارية',
      pasDes: 'ابدأ سيريتك الأولى لمتابعة مزرعتك يومياً.',
      nouvelle: 'بدء سيري جديدة', hangar: 'إعداد الهنكار',
      enCours: 'السيري الجارية', age: 'العمر', vivants: 'الأحياء',
      mortalite: 'النفوق', poids: 'الوزن المتوسط', ic: 'م.ت', ipe: 'م.أ.أ',
      tableau: 'لوحة القيادة', saisir: 'تسجيل اليوم',
      vaccins: 'جدول التطعيم', vente: 'بيع جزئي',
      joursRestants: 'أيام قبل موعد البيع',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const { data: b } = await supabase
        .from('bandes')
        .select('*')
        .eq('eleveur_id', profile.id)
        .in('statut', ['en_cours', 'publiee'])
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (b) {
        setSerie(b)
        const { data: jours } = await supabase.from('bande_jours').select('*').eq('bande_id', b.id)
        const { data: pesees } = await supabase.from('bande_pesees').select('*').eq('bande_id', b.id)
        setStats(calcSerie(b, jours || [], pesees || []))
      }
      setLoading(false)
    }
    load()
  }, [profile])

  const age = stats?.age || 0
  const delai = serie?.delai_publication_jours || 35
  const joursRestants = Math.max(0, delai - age)
  const progressPct = Math.min(100, (age / delai) * 100)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
      <p className="text-gray-400">...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#FFF7ED' }}>

      {/* Header */}
      <div className="text-white px-4 pt-10 pb-6" style={{ backgroundColor: '#166534' }}>
        <p className="text-green-200 text-sm">{profile?.prenom}</p>
        <h1 className="text-2xl font-bold">{tx.titre}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {!serie ? (
          /* ── AUCUNE SÉRIE ── */
          <div className="card text-center py-10 space-y-4">
            <div className="text-6xl">🐣</div>
            <p className="font-bold text-gray-700 text-lg">{tx.pasSerie}</p>
            <p className="text-gray-400 text-sm px-6">{tx.pasDes}</p>
            <button onClick={() => navigate('/eleveur/serie/nouvelle')} className="btn-primary">
              + {tx.nouvelle}
            </button>
            <button onClick={() => navigate('/eleveur/hangar')}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium text-sm">
              🏗 {tx.hangar}
            </button>
          </div>
        ) : (
          <>
            {/* ── CARTE SÉRIE ACTIVE ── */}
            <div className="card" style={{ borderLeft: '4px solid #166534' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-800">{tx.enCours}</p>
                  <p className="text-xs text-gray-400">{serie.souche}</p>
                </div>
                <span className="text-2xl font-black" style={{ color: '#166534' }}>J+{age}</span>
              </div>

              {/* Barre de progression */}
              <div className="bg-gray-100 rounded-full h-2 mb-1">
                <div className="h-2 rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: '#166534' }} />
              </div>
              <p className="text-xs text-gray-400 text-right mb-3">
                {joursRestants > 0 ? `${joursRestants} ${tx.joursRestants}` : lang === 'fr' ? '🔔 Lot prêt à vendre !' : '🔔 جاهز للبيع!'}
              </p>

              {/* KPIs */}
              {stats && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { lbl: tx.vivants, val: stats.vivants.toLocaleString(), color: 'text-gray-800' },
                    { lbl: tx.mortalite, val: `${stats.tauxMort.toFixed(1)}%`, color: stats.tauxMort > 5 ? 'text-red-600' : 'text-gray-700' },
                    { lbl: tx.poids, val: `${stats.poids_g.toFixed(0)}g`, color: 'text-gray-700' },
                    { lbl: tx.ic, val: stats.ic ? stats.ic.toFixed(2) : '—', color: icColor(stats.ic) },
                  ].map((k, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-xs text-gray-400 leading-tight">{k.lbl}</p>
                      <p className={`font-black text-sm ${k.color}`}>{k.val}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => navigate(`/eleveur/serie/${serie.id}/jour`)}
                  className="py-3 text-white rounded-xl font-semibold text-sm" style={{ backgroundColor: '#166534' }}>
                  ✏️ {tx.saisir}
                </button>
                <button onClick={() => navigate(`/eleveur/serie/${serie.id}`)}
                  className="py-3 rounded-xl font-semibold text-sm border-2" style={{ borderColor: '#166534', color: '#166534' }}>
                  📊 {tx.tableau}
                </button>
              </div>
            </div>

            {/* ── RACCOURCIS ── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '💉', label: tx.vaccins, route: `/eleveur/serie/${serie.id}/vaccins` },
                { icon: '⚖️', label: lang === 'fr' ? 'Peser' : 'وزن', route: `/eleveur/serie/${serie.id}/pesee` },
                { icon: '💰', label: tx.vente, route: `/eleveur/serie/${serie.id}/vente` },
                { icon: '🏗', label: tx.hangar, route: '/eleveur/hangar' },
              ].map(({ icon, label, route }) => (
                <button key={route} onClick={() => navigate(route)}
                  className="card flex items-center gap-3 py-4 text-left hover:bg-orange-50 transition-colors">
                  <span className="text-2xl">{icon}</span>
                  <span className="font-semibold text-sm text-gray-700">{label}</span>
                </button>
              ))}
            </div>

            {/* ── PRIX DE SEUIL ── */}
            {stats?.prixSeuil > 0 && (
              <div className="card flex items-center justify-between" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div>
                  <p className="text-xs text-gray-400">{lang === 'fr' ? 'Prix de seuil (break-even)' : 'سعر التعادل'}</p>
                  <p className="font-black text-xl" style={{ color: '#E85C0D' }}>{stats.prixSeuil.toFixed(0)} DA/kg</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{lang === 'fr' ? 'Coût total à date' : 'التكلفة الإجمالية'}</p>
                  <p className="font-bold text-gray-600">{formatDA(stats.coutTotal)}</p>
                </div>
              </div>
            )}

            {/* ── NOUVELLE SÉRIE ── */}
            <button onClick={() => navigate('/eleveur/serie/nouvelle')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
              + {tx.nouvelle}
            </button>
          </>
        )}

      </div>
      <BottomNav />
    </div>
  )
}

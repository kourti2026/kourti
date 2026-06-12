import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import Onboarding from '../../components/Onboarding'
import { calcAge, ageBadge } from '../../lib/utils'
import { wilayas } from '../../data/wilayas'
import { getMeilleuresOffres, expirerOffres } from '../../lib/publication'

export default function AccueilAcheteur() {
  const { profile, logout }   = useAuth()
  const navigate              = useNavigate()
  const [annonces, setAnnonces] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [cours,    setCours]    = useState({})
  const [topOffres, setTopOffres] = useState({}) // meilleure offre par annonce
  const [filtre,   setFiltre]   = useState({ wilaya: '', poidsMin: '', poidsMax: '' })
  const [showFiltre, setShowFiltre] = useState(false)

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      titre:       'الإعلانات المتاحة',
      filtrer:     'تصفية',
      tousWilayas: 'كل الولايات',
      poidsMin:    'الوزن الأدنى',
      poidsMax:    'الوزن الأقصى',
      appliquer:   'تطبيق',
      reinit:      'إعادة تعيين',
      sujets:      'رأس',
      age:         'يوم',
      kgMoy:       'كغ',
      voirOffre:   'عرض سعر',
      pasLots:     'لا توجد إعلانات متاحة حالياً',
      chargement:  'جاري التحميل...',
      coursJour:   'السعر اليوم',
    },
    fr: {
      titre:       'Annonces disponibles',
      filtrer:     'Filtrer',
      tousWilayas: 'Toutes les wilayas',
      poidsMin:    'Poids min',
      poidsMax:    'Poids max',
      appliquer:   'Appliquer',
      reinit:      'Réinitialiser',
      sujets:      'sujets',
      age:         'j',
      kgMoy:       'kg',
      voirOffre:   'Faire une offre',
      pasLots:     'Aucune annonce disponible pour le moment',
      chargement:  'Chargement...',
      coursJour:   'Cours du jour',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    loadAnnonces()

    // Recharge quand l'onglet/app reprend le focus (ex: retour depuis vue éleveur)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAnnonces()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Realtime : retire une annonce dès qu'elle n'est plus 'active'
    const channel = supabase
      .channel('annonces-listing')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'annonces',
      }, (payload) => {
        const updated = payload.new
        if (updated.statut !== 'active') {
          setAnnonces(prev => prev.filter(a => a.id !== updated.id))
        } else {
          setAnnonces(prev => prev.map(a =>
            a.id === updated.id
              ? { ...a, nb_sujets_restants: updated.nb_sujets_restants }
              : a
          ))
        }
      })
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [])

  const loadAnnonces = async () => {
    setLoading(true)

    // Balaye les offres expirées (les enchères affichées restent vivantes)
    await expirerOffres()

    // Charge les annonces actives avec le profil de l'éleveur
    let query = supabase
      .from('annonces')
      .select(`
        *,
        eleveur:users!eleveur_id (
          id, prenom, nom, wilaya, commune,
          nb_transactions, note_moyenne, badge
        )
      `)
      .eq('statut', 'active')
      .order('created_at', { ascending: false })

    if (filtre.wilaya)   query = query.eq('wilaya', filtre.wilaya)
    if (filtre.poidsMin) query = query.gte('poids_moyen', parseFloat(filtre.poidsMin))
    if (filtre.poidsMax) query = query.lte('poids_moyen', parseFloat(filtre.poidsMax))

    const { data } = await query
    setAnnonces(data || [])

    // Cours du jour des wilayas concernées + meilleure offre de chaque annonce
    if (data?.length) {
      const wilayas = [...new Set(data.map(a => a.wilaya))]
      const [{ data: coursData }, offresMap] = await Promise.all([
        supabase
          .from('prix_marche')
          .select('*')
          .in('wilaya', wilayas)
          .eq('date', new Date().toISOString().split('T')[0]),
        getMeilleuresOffres(data.map(a => a.id)),
      ])
      const map = {}
      coursData?.forEach(c => { map[c.wilaya] = c })
      setCours(map)
      setTopOffres(offresMap)
    }

    setLoading(false)
  }

  const handleFiltreApply = () => {
    setShowFiltre(false)
    loadAnnonces()
  }

  const handleFiltreReset = () => {
    setFiltre({ wilaya: '', poidsMin: '', poidsMax: '' })
    setShowFiltre(false)
    loadAnnonces()
  }

  const badgeLabel = (badge) => {
    const map = {
      nouveau:   { ar: 'جديد',     fr: 'Nouveau',   color: 'bg-gray-100 text-gray-600' },
      actif:     { ar: 'نشط',      fr: 'Actif',     color: 'bg-blue-100 text-blue-600' },
      confirme:  { ar: 'موثوق ✓',  fr: 'Confirmé ✓',color: 'bg-green-100 text-green-700' },
      fiable:    { ar: 'موثوق ⭐', fr: 'Fiable ⭐', color: 'bg-emerald-100 text-emerald-700' },
      reference: { ar: 'مرجع 👑',  fr: 'Référence 👑', color: 'bg-yellow-100 text-yellow-700' },
    }
    return map[badge] || map.nouveau
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-24">
      {/* Premiers pas : 3 écrans, une seule fois */}
      <Onboarding role="acheteur" lang={lang} />

      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">كورتي</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFiltre(!showFiltre)}
              className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full text-sm"
            >
              ⚙️ {tx.filtrer}
            </button>
            <button
              onClick={async () => { await logout(); navigate('/auth') }}
              className="text-green-200 text-sm px-3 py-1.5 rounded-full border border-green-400"
            >
              {lang === 'fr' ? 'Déco' : 'خروج'}
            </button>
          </div>
        </div>
      </div>

      {/* Panel filtres */}
      {showFiltre && (
        <div className="bg-white border-b border-gray-100 px-4 py-4 space-y-3">
          <select
            value={filtre.wilaya}
            onChange={e => setFiltre(f => ({ ...f, wilaya: e.target.value }))}
            className="input-field py-3 text-sm"
          >
            <option value="">{tx.tousWilayas}</option>
            {wilayas.map(w => (
              <option key={w.code} value={w.code}>{w.code} — {w.nom}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <input
              type="number" inputMode="decimal" placeholder={tx.poidsMin}
              value={filtre.poidsMin}
              onChange={e => setFiltre(f => ({ ...f, poidsMin: e.target.value }))}
              className="input-field py-3 text-sm flex-1"
            />
            <input
              type="number" inputMode="decimal" placeholder={tx.poidsMax}
              value={filtre.poidsMax}
              onChange={e => setFiltre(f => ({ ...f, poidsMax: e.target.value }))}
              className="input-field py-3 text-sm flex-1"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleFiltreReset}  className="btn-secondary py-3 text-sm">
              {tx.reinit}
            </button>
            <button onClick={handleFiltreApply}  className="btn-primary py-3 text-sm">
              {tx.appliquer}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">{tx.chargement}</div>
        ) : annonces.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">🔍</div>
            <p className="font-bold text-gray-700 text-lg mb-2">{tx.pasLots}</p>
            <p className="text-gray-400 text-sm mb-6">
              {lang === 'fr'
                ? 'Les éleveurs publient leurs annonces en temps réel. Revenez dans quelques instants ou modifiez vos filtres.'
                : 'يقوم المربون بنشر إعلاناتهم في الوقت الفعلي. عد بعد قليل أو عدّل الفلاتر.'}
            </p>
            <button
              onClick={loadAnnonces}
              className="btn-secondary py-3 text-sm w-auto px-8 inline-block"
            >
              🔄 {lang === 'fr' ? 'Actualiser' : 'تحديث'}
            </button>
          </div>
        ) : (
          annonces.map(ann => {
            const ageActuel  = calcAge(ann.age_initial_sujets, ann.date_publication)
            const badge      = ageBadge(ageActuel)
            const coursW     = cours[ann.wilaya]
            const elevBadge  = badgeLabel(ann.eleveur?.badge)

            return (
              <div
                key={ann.id}
                className="card cursor-pointer active:scale-98 transition-transform"
                onClick={() => navigate(`/acheteur/lot/${ann.id}`)}
              >
                {/* Ligne 1 : wilaya + age badge */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-800 text-lg">
                      {wilayas.find(w => w.code === ann.wilaya)?.nom || ann.wilaya}
                    </p>
                    <p className="text-gray-400 text-sm">{ann.commune}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${badge.color}`}>
                    {ageActuel} {tx.age}
                  </span>
                </div>

                {/* Photo si disponible */}
                {ann.photos?.[0] && (
                  <img
                    src={ann.photos[0]}
                    alt="lot"
                    className="w-full h-36 object-cover rounded-xl mb-3"
                  />
                )}

                {/* Stats */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
                    <p className="font-bold text-kourti-green text-xl">
                      {ann.nb_sujets_restants.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">{tx.sujets}</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
                    <p className="font-bold text-gray-700 text-xl">{ann.poids_moyen}</p>
                    <p className="text-xs text-gray-400">{tx.kgMoy}</p>
                  </div>
                  {ann.souche && (
                    <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
                      <p className="font-bold text-gray-700 text-sm mt-1">{ann.souche}</p>
                      <p className="text-xs text-gray-400">souche</p>
                    </div>
                  )}
                </div>

                {/* Acceptation immédiate */}
                {ann.prix_acceptation_auto && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
                    <span className="text-xs text-yellow-700 font-bold">
                      ⚡ {lang === 'fr' ? 'Acceptation immédiate' : 'قبول فوري'}
                    </span>
                    <span className="font-black text-yellow-700">
                      {ann.prix_acceptation_auto} DA/kg
                    </span>
                  </div>
                )}

                {/* Meilleure offre en cours — enchère à dépasser */}
                {topOffres[ann.id] && (
                  <div className="bg-orange-50 rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
                    <span className="text-xs text-orange-600 font-semibold">
                      ⭐ {lang === 'fr' ? 'Meilleure offre' : 'أفضل عرض'}
                    </span>
                    <span className="font-bold text-kourti-orange">
                      {topOffres[ann.id]} DA/kg
                    </span>
                  </div>
                )}

                {/* Cours du jour */}
                {coursW && (
                  <div className="bg-green-50 rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500">{tx.coursJour}</span>
                    <span className="font-bold text-kourti-green">
                      {coursW.prix_min} — {coursW.prix_max} DA/kg
                    </span>
                  </div>
                )}

                {/* Éleveur + bouton */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-kourti-green">
                      {ann.eleveur?.prenom?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {ann.eleveur?.prenom} {ann.eleveur?.nom?.[0]}.
                      </p>
                      <p className={`text-xs ${elevBadge.color} px-1.5 py-0.5 rounded-full`}>
                        {elevBadge[lang]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/acheteur/lot/${ann.id}`) }}
                    className="py-2 px-4 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#E85C0D' }}
                  >
                    {tx.voirOffre}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav role="acheteur" />
    </div>
  )
}

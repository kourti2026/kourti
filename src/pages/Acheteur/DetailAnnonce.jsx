import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { calcAge, ageBadge, formatDA } from '../../lib/utils'
import { wilayas } from '../../data/wilayas'
import { expirerOffres } from '../../lib/publication'
import { waLink, msgPartageAnnonce } from '../../lib/whatsapp'

export default function DetailAnnonce() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { profile } = useAuth()

  const [annonce,  setAnnonce]  = useState(null)
  const [eleveur,  setEleveur]  = useState(null)
  const [cours,    setCours]    = useState(null)
  const [monOffre, setMonOffre] = useState(null)
  const [offres,   setOffres]   = useState([])
  const [loading,  setLoading]  = useState(true)

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      retour:       'رجوع',
      detail:       'تفاصيل الإعلان',
      sujets:       'رأس',
      age:          'يوم',
      kgMoy:        'كغ متوسط',
      souche:       'السلالة',
      note:         'ملاحظة المربي',
      eleveur:      'المربي',
      wilaya:       'الولاية',
      commune:      'البلدية',
      transactions: 'صفقة منجزة',
      coursJour:    'سعر اليوم',
      valeurEstim:  'القيمة المقدرة',
      faireOffre:   'تقديم عرض سعر',
      offreExist:   'عرضك الحالي',
      modifierOffre:'تعديل عرضي',
      da_kg:        'دج/كغ',
      cash:         'نقداً',
      credit:       'آجل',
      chargement:   'جاري التحميل...',
      fiabilite:    'معدل الموثوقية',
      annonces:     'إعلان',
    },
    fr: {
      retour:       'Retour',
      detail:       'Détail de l\'annonce',
      sujets:       'sujets',
      age:          'j',
      kgMoy:        'kg moy.',
      souche:       'Souche',
      note:         'Note du vendeur',
      eleveur:      'Éleveur',
      wilaya:       'Wilaya',
      commune:      'Commune',
      transactions: 'transaction(s)',
      coursJour:    'Cours du jour',
      valeurEstim:  'Valeur estimée',
      faireOffre:   'Faire une offre',
      offreExist:   'Mon offre actuelle',
      modifierOffre:'Modifier mon offre',
      da_kg:        'DA/kg',
      cash:         'Cash',
      credit:       'Crédit',
      chargement:   'Chargement...',
      fiabilite:    'Taux fiabilité',
      annonces:     'annonce(s)',
    }
  }
  const tx = t[lang]

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    setLoading(true)

    // Balaye les offres expirées avant d'afficher les enchères
    await expirerOffres()

    // Annonce + éleveur
    const { data: ann } = await supabase
      .from('annonces')
      .select(`
        *,
        eleveur:users!eleveur_id (
          id, prenom, nom, wilaya, commune,
          nb_transactions, note_moyenne, badge
        )
      `)
      .eq('id', id)
      .single()

    if (ann) {
      setAnnonce(ann)
      setEleveur(ann.eleveur)

      const [{ data: coursData }, { data: offresData }] = await Promise.all([
        // Cours du jour wilaya
        supabase
          .from('prix_marche')
          .select('*')
          .eq('wilaya', ann.wilaya)
          .eq('date', new Date().toISOString().split('T')[0])
          .maybeSingle(),
        // Enchères : toutes les offres en attente, prix décroissant
        supabase
          .from('offres')
          .select('id, prix_kg, quantite, acheteur_id, type_paiement, date_paiement_convenue, created_at, acheteur:users!acheteur_id(prenom)')
          .eq('annonce_id', id)
          .eq('statut', 'en_attente')
          .order('prix_kg', { ascending: false }),
      ])
      setCours(coursData)
      setOffres(offresData || [])
      setMonOffre(offresData?.find(o => o.acheteur_id === profile.id) || null)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">{tx.chargement}</p>
      </div>
    )
  }

  if (!annonce) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">Annonce introuvable</p>
      </div>
    )
  }

  const ageActuel = calcAge(annonce.age_initial_sujets, annonce.date_publication)
  const badge     = ageBadge(ageActuel)
  const valeur    = cours
    ? annonce.nb_sujets_restants * annonce.poids_moyen * cours.prix_moyen
    : null

  const badgeEleveur = {
    nouveau:   { ar: 'جديد',     fr: 'Nouveau',    color: 'bg-gray-100 text-gray-600' },
    actif:     { ar: 'نشط',      fr: 'Actif',      color: 'bg-blue-100 text-blue-600' },
    confirme:  { ar: 'موثوق ✓',  fr: 'Confirmé ✓', color: 'bg-green-100 text-green-700' },
    fiable:    { ar: 'موثوق ⭐', fr: 'Fiable ⭐',  color: 'bg-emerald-100 text-emerald-700' },
    reference: { ar: 'مرجع 👑',  fr: 'Référence 👑', color: 'bg-yellow-100 text-yellow-700' },
  }
  const bElev = badgeEleveur[eleveur?.badge] || badgeEleveur.nouveau

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-32">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold flex-1">{tx.detail}</h1>
        <a
          href={waLink(null, msgPartageAnnonce(annonce, lang))}
          target="_blank" rel="noreferrer"
          className="text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-full"
        >
          📤 {lang === 'fr' ? 'Partager' : 'مشاركة'}
        </a>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Photo principale */}
        {annonce.photos?.[0] && (
          <img
            src={annonce.photos[0]}
            alt="lot"
            className="w-full h-52 object-cover rounded-2xl shadow"
          />
        )}

        {/* Info lot */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-gray-800 text-xl">
                {wilayas.find(w => w.code === annonce.wilaya)?.nom || annonce.wilaya}
              </p>
              <p className="text-gray-400 text-sm">{annonce.commune}</p>
            </div>
            <span className={`text-sm px-4 py-1.5 rounded-full font-semibold ${badge.color}`}>
              {ageActuel} {tx.age}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-kourti-green">
                {annonce.nb_sujets_restants.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">{tx.sujets}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{annonce.poids_moyen}</p>
              <p className="text-xs text-gray-400">{tx.kgMoy}</p>
            </div>
            {annonce.souche ? (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-700">{annonce.souche}</p>
                <p className="text-xs text-gray-400">{tx.souche}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-400">—</p>
                <p className="text-xs text-gray-400">{tx.souche}</p>
              </div>
            )}
          </div>

          {annonce.note_libre && (
            <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-400 mb-1">{tx.note}</p>
              <p className="text-sm text-gray-600">{annonce.note_libre}</p>
            </div>
          )}
        </div>

        {/* Acceptation immédiate — l'offre qui atteint ce prix gagne sur le champ */}
        {annonce.prix_acceptation_auto && (
          <div className="card bg-yellow-50 border-2 border-yellow-300 flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-700 font-bold">
                ⚡ {lang === 'fr' ? 'Acceptation immédiate' : 'قبول فوري'}
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">
                {lang === 'fr'
                  ? 'Offrez ce prix (chargement sous 48 h) et la vente est conclue instantanément'
                  : 'اعرض هذا السعر (تحميل خلال 48 سا) وتُقبل صفقتك فوراً'}
              </p>
            </div>
            <p className="text-2xl font-black text-yellow-700 whitespace-nowrap">
              {annonce.prix_acceptation_auto} <span className="text-xs font-normal">{tx.da_kg}</span>
            </p>
          </div>
        )}

        {/* Enchères — prix offerts visibles par tous les acheteurs */}
        {offres.length > 0 && (
          <div className="card border-l-4 border-kourti-orange">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase">
                💰 {lang === 'fr' ? 'Enchères en cours' : 'المزايدات الجارية'}
              </p>
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-semibold">
                {offres.length} {lang === 'fr' ? 'offre(s)' : 'عرض'}
              </span>
            </div>
            {/* Meilleure offre */}
            <div className="bg-orange-50 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-orange-700">
                ⭐ {lang === 'fr' ? 'Meilleure offre' : 'أفضل عرض'}
              </span>
              <span className="text-2xl font-black text-kourti-orange">
                {offres[0].prix_kg} <span className="text-sm font-normal text-gray-500">{tx.da_kg}</span>
              </span>
            </div>
            {/* Autres offres */}
            {offres.slice(1).map(o => (
              <div key={o.id} className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-500">
                  {o.acheteur?.prenom?.[0] || '?'}*** · {o.quantite.toLocaleString()} {tx.sujets}
                </span>
                <span className="font-bold text-gray-700">{o.prix_kg} {tx.da_kg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cours du jour */}
        {cours && (
          <div className="card border-l-4 border-kourti-green">
            <p className="text-xs text-gray-400 mb-1">{tx.coursJour}</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-kourti-green">
                {cours.prix_min} — {cours.prix_max}
                <span className="text-sm font-normal"> DA/kg</span>
              </p>
              {valeur && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">{tx.valeurEstim}</p>
                  <p className="font-bold text-gray-700">{formatDA(valeur)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profil éleveur */}
        {eleveur && (
          <div className="card">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
              {tx.eleveur}
            </p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center
                              text-xl font-bold text-kourti-green">
                {eleveur.prenom?.[0]}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">
                  {eleveur.prenom} {eleveur.nom?.[0]}.
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${bElev.color}`}>
                  {lang === 'fr' ? bElev.fr : bElev.ar}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">
                  {eleveur.nb_transactions || 0}
                </p>
                <p className="text-xs text-gray-400">{tx.transactions}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">
                  {eleveur.note_moyenne ? `${(eleveur.note_moyenne / 5 * 100).toFixed(0)}%` : '—'}
                </p>
                <p className="text-xs text-gray-400">{tx.fiabilite}</p>
              </div>
            </div>
          </div>
        )}

        {/* Mon offre existante */}
        {monOffre && (
          <div className="card border-2 border-kourti-green bg-green-50">
            <p className="text-xs text-gray-500 mb-2 font-medium">{tx.offreExist}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-kourti-green">
                  {monOffre.prix_kg} {tx.da_kg}
                </p>
                <span className="text-sm text-gray-500">
                  {monOffre.type_paiement === 'cash' ? tx.cash : `${tx.credit} — ${monOffre.date_paiement_convenue || ''}`}
                </span>
              </div>
              <button
                onClick={() => navigate(`/acheteur/lot/${id}/offre`)}
                className="border-2 border-kourti-green text-kourti-green px-4 py-2 rounded-xl text-sm font-semibold"
              >
                {tx.modifierOffre}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CTA fixe */}
      {!monOffre && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 safe-area-bottom">
          <button
            onClick={() => navigate(`/acheteur/lot/${id}/offre`)}
            className="btn-primary text-lg py-4"
          >
            💰 {offres.length > 0
              ? (lang === 'fr' ? 'Surenchérir' : 'زايد على السعر')
              : tx.faireOffre}
          </button>
        </div>
      )}
    </div>
  )
}

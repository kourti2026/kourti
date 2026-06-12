import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import { calcAge, ageBadge, formatDA } from '../../lib/utils'
import { autoPublierSiEcheance, getSerieEnPlace } from '../../lib/publication'
import { waLink, msgPartageAnnonce } from '../../lib/whatsapp'

export default function AccueilEleveur() {
  const { profile, logout }  = useAuth()
  const navigate             = useNavigate()
  const [annonce,   setAnnonce]   = useState(null)
  const [serie,     setSerie]     = useState(null)
  const [nbOffres,  setNbOffres]  = useState(0)
  const [cours,     setCours]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [txEnCours,      setTxEnCours]      = useState([])
  const [showClotureDlg, setShowClotureDlg] = useState(false)
  const [showSuspendDlg, setShowSuspendDlg] = useState(false)
  const [showAutoDlg,    setShowAutoDlg]    = useState(false)
  const [prixAutoInput,  setPrixAutoInput]  = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      bonjour:          'أهلاً',
      txEnCours:        'صفقة جارية',
      etapes:           { accord: 'اتفاق', chargement: 'تحميل', pesee: 'وزن', cloture: 'إغلاق' },
      pasAnnonce:       'ليس لديك إعلان نشط حالياً',
      pasSerie:         'لا توجد سيري في المزرعة',
      pasSerieDesc:     'يبدأ البيع من السيري: ابدأ سيريتك، وعند الموعد المحدد يُنشر إعلان البيع تلقائياً.',
      demarrerSerie:    'بدء سيري جديدة',
      venteAutoDans:    'النشر التلقائي للبيع بعد',
      jours:            'يوم',
      venteAutoPrete:   'السيري جاهزة للبيع',
      vendreMaintenant: 'عرض للبيع الآن',
      publier:          'نشر إعلاني',
      fojActif:         'إعلانك النشط',
      sujets:           'رأس',
      poids:            'كغ متوسط',
      age:              'يوم',
      voirOffres:       'رؤية العروض',
      suspendre:        'تعليق',
      suspendreConfirm: 'تعليق الإعلان مؤقتاً؟ يمكنك إعادة نشره لاحقاً.',
      cloturerLot:      'إغلاق الإعلان',
      cloturerConfirm:  'إغلاق الإعلان نهائياً؟ (البواقي غير قابلة للبيع)',
      annuler:          'إلغاء',
      confirmer:        'تأكيد',
      coursJour:        'سعر اليوم',
      valeurEstim:      'القيمة المقدرة',
      chargement:       'جاري التحميل...',
    },
    fr: {
      bonjour:          'Bonjour',
      txEnCours:        'Transaction en cours',
      etapes:           { accord: 'Accord', chargement: 'Chargement', pesee: 'Pesée', cloture: 'Clôture' },
      pasAnnonce:       'Aucune annonce active pour le moment',
      pasSerie:         'Aucune série en place',
      pasSerieDesc:     'La vente part de la série : démarrez votre série, et à l\'échéance l\'annonce de vente est publiée automatiquement.',
      demarrerSerie:    'Démarrer une série',
      venteAutoDans:    'Mise en vente automatique dans',
      jours:            'jour(s)',
      venteAutoPrete:   'Série prête à la vente',
      vendreMaintenant: 'Mettre en vente maintenant',
      publier:          'Publier mon annonce',
      fojActif:         'Mon annonce active',
      sujets:           'sujets',
      poids:            'kg moy.',
      age:              'j',
      voirOffres:       'Voir les offres',
      suspendre:        'Suspendre',
      suspendreConfirm: "Suspendre l'annonce temporairement ? Vous pourrez la republier.",
      cloturerLot:      "Clôturer l'annonce",
      cloturerConfirm:  'Clôturer définitivement ? (sujets restants = invendables)',
      annuler:          'Annuler',
      confirmer:        'Confirmer',
      coursJour:        'Cours du jour',
      valeurEstim:      'Valeur estimée',
      chargement:       'Chargement...',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    // Mise en vente automatique si la série a atteint son échéance (J+35…)
    await autoPublierSiEcheance(profile)

    const [annRes, coursRes, txRes, serieData] = await Promise.all([
      supabase.from('annonces').select('*')
        .eq('eleveur_id', profile.id).eq('statut', 'active').limit(1).maybeSingle(),
      supabase.from('prix_marche').select('*')
        .eq('wilaya', profile.wilaya).eq('date', today).maybeSingle(),
      supabase.from('transactions')
        .select('id, statut_transaction, quantite_accordee, prix_kg_reel, montant_total_reel, date_chargement_prevue')
        .eq('eleveur_id', profile.id)
        .not('statut_transaction', 'in', '(cloture,annulee)')
        .order('created_at', { ascending: false }).limit(3),
      getSerieEnPlace(profile.id),
    ])

    if (annRes.data) {
      setAnnonce(annRes.data)
      const { count } = await supabase
        .from('offres').select('*', { count: 'exact', head: true })
        .eq('annonce_id', annRes.data.id).eq('statut', 'en_attente')
      setNbOffres(count || 0)
    }

    setCours(coursRes.data || null)
    setTxEnCours(txRes.data || [])
    setSerie(serieData)
    setLoading(false)
  }

  const handleSuspendre = async () => {
    const { error } = await supabase.rpc('maj_statut_annonce', {
      p_annonce_id: annonce.id,
      p_statut: 'suspendue',
    })
    if (!error) setAnnonce(null)
  }

  // Prix d'acceptation automatique — modifiable à tout moment sur l'annonce active
  const handleSavePrixAuto = async () => {
    const val = prixAutoInput ? parseFloat(prixAutoInput) : null
    const { error } = await supabase
      .from('annonces')
      .update({ prix_acceptation_auto: val })
      .eq('id', annonce.id)
    if (!error) setAnnonce(prev => ({ ...prev, prix_acceptation_auto: val }))
    setShowAutoDlg(false)
  }

  const handleCloturerLot = async () => {
    const { error } = await supabase.rpc('maj_statut_annonce', {
      p_annonce_id: annonce.id,
      p_statut: 'vendue',
      p_nb_sujets: 0,
    })
    if (error) { alert('Erreur: ' + error.message); return }
    setShowClotureDlg(false)
    setAnnonce(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
        <p className="text-gray-400 text-lg">{tx.chargement}</p>
      </div>
    )
  }

  const ageActuel  = annonce ? calcAge(annonce.age_initial_sujets, annonce.date_publication) : null
  const badge      = ageActuel ? ageBadge(ageActuel) : null
  const valeur     = annonce && cours ? annonce.nb_sujets_restants * annonce.poids_moyen * cours.prix_moyen : null

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#FFF7ED' }}>

      {/* Header */}
      <div className="text-white px-4 pt-10 pb-6" style={{ backgroundColor: '#E85C0D' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-200 text-sm">{tx.bonjour}</p>
            <h1 className="text-2xl font-bold">{profile?.prenom} {profile?.nom?.[0]}.</h1>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/auth') }}
            className="text-orange-200 text-sm px-3 py-1 rounded-full border border-orange-300"
          >
            {lang === 'fr' ? 'Déconnexion' : 'خروج'}
          </button>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-4">

        {/* Transactions en cours (3 max en parallèle) */}
        {txEnCours.map(txc => (
          <div
            key={txc.id}
            className="card border-2 border-orange-400 bg-orange-50 cursor-pointer"
            onClick={() => navigate('/transaction/' + txc.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-500 font-bold uppercase mb-1">
                  🔔 {tx.txEnCours}
                  {txc.quantite_accordee ? ` — ${txc.quantite_accordee.toLocaleString()} ${tx.sujets}` : ''}
                </p>
                <p className="font-bold text-gray-800">
                  {tx.etapes[txc.statut_transaction] || txc.statut_transaction}
                  {txc.date_chargement_prevue && txc.statut_transaction === 'accord' && (
                    <span className="text-xs font-normal text-gray-500">
                      {' '}· 🚛 {new Date(txc.date_chargement_prevue).toLocaleString(
                        lang === 'fr' ? 'fr-DZ' : 'ar-DZ',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
                {txc.statut_transaction === 'pesee' && (
                  <p className="text-xs text-orange-600 mt-0.5">
                    {lang === 'fr' ? '⚠️ En attente de votre confirmation de paiement' : '⚠️ بانتظار تأكيد استلام الدفع'}
                  </p>
                )}
              </div>
              <span className="text-orange-400 text-xl">→</span>
            </div>
          </div>
        ))}

        {/* Cours du jour */}
        <div className="card" style={{ borderRight: '4px solid #166534' }}>
          <p className="text-xs text-gray-400 mb-1">{tx.coursJour} — {profile?.wilaya}</p>
          {cours ? (
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: '#166534' }}>
                {cours.prix_min} — {cours.prix_max} <span className="text-sm font-normal">DA/kg</span>
              </p>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                {cours.fiabilite === 'confirme' ? '✓ Confirmé' : '~ Estimation'}
              </span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              {lang === 'fr' ? "Pas encore de données pour aujourd'hui" : 'لا توجد بيانات لهذا اليوم'}
            </p>
          )}
        </div>

        {/* Annonce active, série en cours, ou démarrage */}
        {!annonce && !serie ? (
          /* Pas de série → la vente commence par l'élevage */
          <div className="card text-center py-10 px-6">
            <div className="text-6xl mb-4">🐣</div>
            <p className="font-bold text-gray-700 text-lg mb-2">{tx.pasSerie}</p>
            <p className="text-gray-400 text-sm mb-6">{tx.pasSerieDesc}</p>
            <button onClick={() => navigate('/eleveur/serie/nouvelle')} className="btn-primary">
              🐣 {tx.demarrerSerie}
            </button>
          </div>
        ) : !annonce ? (
          /* Série en place, pas encore d'annonce → compte à rebours vente auto */
          (() => {
            const ageSerie  = Math.floor((Date.now() - new Date(serie.date_mise_en_place)) / 86400000)
            const delai     = serie.delai_publication_jours || 35
            const restants  = Math.max(0, delai - ageSerie)
            const progress  = Math.min(100, (ageSerie / delai) * 100)
            return (
              <div className="card text-center py-8 px-6">
                <div className="text-5xl mb-3">🐔</div>
                <p className="font-bold text-gray-700 text-lg mb-1">
                  {restants > 0 ? `${tx.venteAutoDans} ${restants} ${tx.jours}` : `🔔 ${tx.venteAutoPrete}`}
                </p>
                <p className="text-gray-400 text-sm mb-4">J+{ageSerie} / J+{delai}</p>
                <div className="bg-gray-100 rounded-full h-2 mb-5">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: '#166534' }} />
                </div>
                <button onClick={() => navigate('/eleveur/publier')} className="btn-primary">
                  📢 {tx.vendreMaintenant}
                </button>
                <button onClick={() => navigate(`/eleveur/serie/${serie.id}`)}
                  className="w-full mt-2 py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-medium text-sm">
                  📊 {lang === 'fr' ? 'Tableau de bord série' : 'لوحة قيادة السيري'}
                </button>
              </div>
            )
          })()
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-800 text-lg">{tx.fojActif}</p>
              <span className={'text-xs px-3 py-1 rounded-full font-medium ' + (badge?.color || '')}>
                {ageActuel} {tx.age} — {badge?.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#166534' }}>
                  {annonce.nb_sujets_restants.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{tx.sujets}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#166534' }}>{annonce.poids_moyen}</p>
                <p className="text-xs text-gray-500">{tx.poids}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{ageActuel}</p>
                <p className="text-xs text-gray-500">{tx.age}</p>
              </div>
            </div>

            {valeur && (
              <div className="bg-green-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{tx.valeurEstim}</p>
                <p className="text-xl font-bold" style={{ color: '#166534' }}>{formatDA(valeur)}</p>
              </div>
            )}

            {annonce.photos?.[0] && (
              <img src={annonce.photos[0]} alt="lot" className="w-full h-40 object-cover rounded-xl mb-4" />
            )}

            <button
              onClick={() => navigate('/eleveur/offres')}
              className="w-full py-4 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-base"
              style={{ backgroundColor: '#E85C0D' }}
            >
              {nbOffres > 0 && (
                <span className="bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {nbOffres}
                </span>
              )}
              📋 {tx.voirOffres}
            </button>

            {/* Acceptation auto + partage WhatsApp */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setPrixAutoInput(annonce.prix_acceptation_auto ? String(annonce.prix_acceptation_auto) : '')
                  setShowAutoDlg(true)
                }}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 ${
                  annonce.prix_acceptation_auto
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                ⚡ {annonce.prix_acceptation_auto
                  ? `${annonce.prix_acceptation_auto} DA/kg`
                  : (lang === 'fr' ? 'Acceptation auto' : 'قبول فوري')}
              </button>
              <a
                href={waLink(null, msgPartageAnnonce(annonce, lang))}
                target="_blank" rel="noreferrer"
                className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 border-green-400 bg-green-50 text-green-700 text-center"
              >
                📤 {lang === 'fr' ? 'Partager' : 'مشاركة'}
              </a>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowSuspendDlg(true)}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-medium text-sm"
              >
                ⏸ {tx.suspendre}
              </button>
              <button
                onClick={() => setShowClotureDlg(true)}
                className="flex-1 py-3 bg-red-50 border-2 border-red-400 text-red-600 rounded-xl font-semibold text-sm"
              >
                🔒 {tx.cloturerLot}
              </button>
            </div>
          </div>
        )}

      </div>

      <BottomNav role="eleveur" />

      {/* Dialog Suspendre */}
      {showSuspendDlg && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <p className="font-bold text-gray-800 text-center">{tx.suspendreConfirm}</p>
            <button onClick={async () => { setShowSuspendDlg(false); await handleSuspendre() }} className="btn-primary">
              {tx.confirmer}
            </button>
            <button onClick={() => setShowSuspendDlg(false)} className="btn-secondary">
              {tx.annuler}
            </button>
          </div>
        </div>
      )}

      {/* Dialog Prix d'acceptation automatique */}
      {showAutoDlg && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <p className="font-bold text-gray-800">
              ⚡ {lang === 'fr' ? 'Acceptation immédiate' : 'قبول فوري'}
            </p>
            <p className="text-xs text-gray-400">
              {lang === 'fr'
                ? 'Toute offre atteignant ce prix (chargement sous 48 h) est acceptée automatiquement, même hors connexion. Videz le champ pour désactiver.'
                : 'أي عرض يبلغ هذا السعر (مع تحميل خلال 48 سا) يُقبل تلقائياً حتى وأنت غير متصل. أفرغ الحقل للإلغاء.'}
            </p>
            <input
              type="number" inputMode="numeric" placeholder="ex: 300"
              value={prixAutoInput}
              onChange={e => setPrixAutoInput(e.target.value)}
              className="input-field text-center text-3xl font-bold"
              style={{ direction: 'ltr' }}
            />
            <button onClick={handleSavePrixAuto} className="btn-primary">
              {tx.confirmer}
            </button>
            <button onClick={() => setShowAutoDlg(false)} className="btn-secondary">
              {tx.annuler}
            </button>
          </div>
        </div>
      )}

      {/* Dialog Clôturer */}
      {showClotureDlg && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <p className="font-bold text-red-700 text-center">{tx.cloturerConfirm}</p>
            <button
              onClick={handleCloturerLot}
              className="w-full py-4 bg-red-600 text-white text-lg font-semibold rounded-2xl"
            >
              🔒 {tx.confirmer}
            </button>
            <button onClick={() => setShowClotureDlg(false)} className="btn-secondary">
              {tx.annuler}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

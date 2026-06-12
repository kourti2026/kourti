import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { offreIndicateur, messageErreur } from '../../lib/utils'

// Créneaux proposés en un tap (le sélecteur date-heure est la saisie
// la plus difficile de l'app pour un public peu habitué)
const creneauDate = (joursPlus, heure) => {
  const d = new Date()
  d.setDate(d.getDate() + joursPlus)
  d.setHours(heure, 0, 0, 0)
  return d
}
const fmtLocal = (d) => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function FormulaireOffre() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { profile } = useAuth()

  const [annonce,      setAnnonce]      = useState(null)
  const [cours,        setCours]        = useState(null)
  const [offreExist,   setOffreExist]   = useState(null)
  const [meilleure,    setMeilleure]    = useState(null) // meilleure offre des autres acheteurs
  const [prix,         setPrix]         = useState('')
  const [quantite,     setQuantite]     = useState('')
  const [modePaie,     setModePaie]     = useState('cash')
  const [datePaie,     setDatePaie]     = useState('')
  const [creneau,      setCreneau]      = useState('') // date+heure de chargement au hangar
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      titre:        'تقديم عرض سعر',
      modifierTitre:'تعديل عرضي',
      prix:         'سعرك (دج/كغ)',
      prixPlaceh:   'مثال: 285',
      quantite:     'الكمية المطلوبة (رأس)',
      quantitePlaceh:'مثال: 2000',
      totalLot:     'الإعلان كاملاً',
      modePaie:     'طريقة الدفع',
      cash:         '💵 نقداً',
      credit:       '📅 آجل',
      datePaie:     'تاريخ الدفع',
      envoyer:      'إرسال العرض',
      modifier:     'تعديل العرض',
      envoi:        'جاري الإرسال...',
      errPrix:      'أدخل سعراً صحيحاً',
      errQuantite:  'أدخل الكمية المطلوبة',
      errDate:      'حدد تاريخ الدفع للبيع الآجل',
      errDateFut:   'يجب أن يكون التاريخ في المستقبل',
      creneau:      'موعد التحميل في الهنكار (يوم وساعة)',
      creneauInfo:  'التزم بهذا الموعد — في حالة الغياب يمكن للمربي إلغاء الصفقة ويتأثر معدل حضورك.',
      errCreneau:   'حدد موعد التحميل (يوم وساعة)',
      errCreneauFut:'يجب أن يكون موعد التحميل في المستقبل',
      annonce:      'معلومات الإعلان',
      sujets:       'رأس',
      poids:        'كغ',
      coursJour:    'السعر اليوم',
      indicateur:   'مقارنة بالسوق',
      retour:       'رجوع',
      avertissement:'تحذير: السعر الآجل ينطوي على مخاطر. KOURTI غير مسؤول عن عدم الدفع.',
    },
    fr: {
      titre:        'Faire une offre',
      modifierTitre:'Modifier mon offre',
      prix:         'Votre prix (DA/kg)',
      prixPlaceh:   'Ex: 285',
      quantite:     'Quantité souhaitée (sujets)',
      quantitePlaceh:'Ex: 2000',
      totalLot:     'Annonce entière',
      modePaie:     'Modalité de paiement',
      cash:         '💵 Cash',
      credit:       '📅 Crédit',
      datePaie:     'Date de règlement',
      envoyer:      'Envoyer l\'offre',
      modifier:     'Modifier l\'offre',
      envoi:        'Envoi en cours...',
      errPrix:      'Entrez un prix valide',
      errQuantite:  'Entrez la quantité souhaitée',
      errDate:      'Précisez la date pour un paiement à crédit',
      errDateFut:   'La date doit être dans le futur',
      creneau:      'Passage au hangar (date et heure de chargement)',
      creneauInfo:  'Engagez-vous sur ce créneau — en cas d\'absence, l\'éleveur peut annuler la transaction et votre taux de présence en pâtit.',
      errCreneau:   'Indiquez la date et l\'heure de chargement',
      errCreneauFut:'Le créneau de chargement doit être dans le futur',
      annonce:      'Infos de l\'annonce',
      sujets:       'sujets',
      poids:        'kg',
      coursJour:    'Cours du jour',
      indicateur:   'vs marché',
      retour:       'Retour',
      avertissement:'Attention : un crédit comporte des risques. KOURTI décline toute responsabilité en cas d\'impayé.',
    }
  }
  const tx = t[lang]

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    setLoading(true)

    const { data: ann } = await supabase
      .from('annonces')
      .select('*, eleveur:users!eleveur_id(prenom, nom)')
      .eq('id', id)
      .single()
    setAnnonce(ann)
    // Pré-remplir la quantité avec le total du lot
    if (ann && !offreExist) {
      setQuantite(String(ann.nb_sujets_restants))
    }

    if (ann) {
      const { data: coursData } = await supabase
        .from('prix_marche')
        .select('*')
        .eq('wilaya', ann.wilaya)
        .eq('date', new Date().toISOString().split('T')[0])
        .maybeSingle()
      setCours(coursData)
    }

    // Meilleure offre des autres acheteurs (enchère à dépasser)
    const { data: topAutre } = await supabase
      .from('offres')
      .select('prix_kg')
      .eq('annonce_id', id)
      .eq('statut', 'en_attente')
      .neq('acheteur_id', profile.id)
      .order('prix_kg', { ascending: false })
      .limit(1)
      .maybeSingle()
    setMeilleure(topAutre?.prix_kg ?? null)

    // Offre existante de cet acheteur (en attente ou en contre-offre)
    const { data: offre } = await supabase
      .from('offres')
      .select('*')
      .eq('annonce_id', id)
      .eq('acheteur_id', profile.id)
      .in('statut', ['en_attente', 'contre_offre'])
      .limit(1)
      .maybeSingle()

    if (offre) {
      setOffreExist(offre)
      setPrix(String(offre.prix_kg))
      setQuantite(String(offre.quantite))
      setModePaie(offre.type_paiement)
      setDatePaie(offre.date_paiement_convenue || '')
      if (offre.date_chargement_prevue) {
        setCreneau(fmtLocal(new Date(offre.date_chargement_prevue)))
      }
    } else {
      // Pré-remplissage : l'utilisateur valide plus qu'il ne saisit
      if (topAutre?.prix_kg) setPrix(String(Math.round(topAutre.prix_kg) + 5))
      setCreneau(fmtLocal(creneauDate(1, 8))) // demain matin 8 h par défaut
    }

    setLoading(false)
  }

  const ajusterPrix = (delta) => {
    setPrix(p => String(Math.max(0, (parseFloat(p) || 0) + delta)))
  }

  const handleSubmit = async () => {
    // Validation
    const prixNum = parseFloat(prix)
    if (!prix || isNaN(prixNum) || prixNum <= 0) {
      setError(tx.errPrix); return
    }
    // Enchère montante : il faut dépasser la meilleure offre des autres acheteurs
    if (meilleure !== null && prixNum <= meilleure) {
      setError(lang === 'fr'
        ? `Votre prix doit dépasser la meilleure offre actuelle (${meilleure} DA/kg)`
        : `يجب أن يتجاوز سعرك أفضل عرض حالي (${meilleure} دج/كغ)`)
      return
    }
    const qtNum = parseInt(quantite)
    if (!quantite || isNaN(qtNum) || qtNum <= 0) {
      setError(tx.errQuantite); return
    }
    if (modePaie === 'differe') {
      if (!datePaie) { setError(tx.errDate); return }
      if (new Date(datePaie) <= new Date()) { setError(tx.errDateFut); return }
    }
    if (!creneau) { setError(tx.errCreneau); return }
    if (new Date(creneau) <= new Date()) { setError(tx.errCreneauFut); return }

    setError('')
    setSubmitting(true)

    try {
      let offreId = offreExist?.id
      if (offreExist) {
        // Mise à jour offre existante — repart pour 24 h
        const { error: updErr } = await supabase
          .from('offres')
          .update({
            prix_kg:               prixNum,
            quantite:              qtNum,
            type_paiement:         modePaie,
            date_paiement_convenue: modePaie === 'differe' ? datePaie : null,
            date_chargement_prevue: new Date(creneau).toISOString(),
            statut:                'en_attente',
            contre_prix_kg:        null,
            contre_quantite:       null,
            expires_at:            new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          })
          .eq('id', offreExist.id)
        if (updErr) throw updErr
      } else {
        // Nouvelle offre (expire automatiquement après 24 h — défaut DB)
        const { data: nouvelle, error: insErr } = await supabase
          .from('offres')
          .insert({
            annonce_id:            id,
            acheteur_id:           profile.id,
            eleveur_id:            annonce.eleveur_id,
            quantite:              qtNum,
            prix_kg:               prixNum,
            type_paiement:         modePaie,
            date_paiement_convenue: modePaie === 'differe' ? datePaie : null,
            date_chargement_prevue: new Date(creneau).toISOString(),
            statut:                'en_attente',
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        offreId = nouvelle?.id
      }

      // Acceptation immédiate ? (trigger SQL si le seuil ⚡ est atteint)
      if (offreId) {
        const { data: apres } = await supabase
          .from('offres')
          .select('statut')
          .eq('id', offreId)
          .single()
        if (apres?.statut === 'acceptee') {
          const { data: txAuto } = await supabase
            .from('transactions')
            .select('id')
            .eq('offre_id', offreId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (txAuto?.id) {
            navigate(`/transaction/${txAuto.id}`, { state: { autoAcceptee: true } })
            return
          }
        }
      }

      // Retour au détail avec confirmation
      navigate(`/acheteur/lot/${id}`, { state: { succes: true } })
    } catch (err) {
      console.error('Erreur offre:', err)
      setError(messageErreur(err, lang))
    } finally {
      setSubmitting(false)
    }
  }

  // Indicateur marché
  const indicateur = cours && prix
    ? offreIndicateur(parseFloat(prix), cours.prix_min, cours.prix_max).icon
    : null

  const indConfig = {
    '↑↑': { color: 'text-green-600', bg: 'bg-green-50', label: lang === 'fr' ? 'Très au-dessus du marché' : 'أعلى بكثير من السوق' },
    '↑':  { color: 'text-green-500', bg: 'bg-green-50', label: lang === 'fr' ? 'Au-dessus du marché'      : 'أعلى من السوق' },
    '→':  { color: 'text-blue-500',  bg: 'bg-blue-50',  label: lang === 'fr' ? 'Dans la fourchette'       : 'ضمن النطاق' },
    '↓':  { color: 'text-orange-500',bg: 'bg-orange-50',label: lang === 'fr' ? 'En dessous du marché'     : 'أقل من السوق' },
    '↓↓': { color: 'text-red-500',   bg: 'bg-red-50',   label: lang === 'fr' ? 'Très bas vs marché'       : 'أقل بكثير من السوق' },
  }
  const indStyle = indicateur ? indConfig[indicateur] : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">...</p>
      </div>
    )
  }

  // Bloquer l'auto-offre
  if (annonce && annonce.eleveur_id === profile.id) {
    return (
      <div className="min-h-screen bg-kourti-orange-bg flex flex-col items-center justify-center px-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <p className="text-gray-600 font-semibold text-lg mb-2">
          {lang === 'fr' ? 'C\'est votre propre annonce' : 'هذا إعلانك الخاص'}
        </p>
        <p className="text-gray-400 text-sm mb-6">
          {lang === 'fr'
            ? 'Vous ne pouvez pas faire une offre sur votre propre annonce.'
            : 'لا يمكنك تقديم عرض على إعلانك الخاص.'}
        </p>
        <button onClick={() => navigate(-1)} className="btn-primary">
          {lang === 'fr' ? 'Retour' : 'رجوع'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-10">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold">
          {offreExist ? tx.modifierTitre : tx.titre}
        </h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Résumé annonce */}
        {annonce && (
          <div className="card bg-gray-50">
            <p className="text-xs text-gray-400 font-medium mb-2">{tx.annonce}</p>
            <div className="flex gap-4 text-sm">
              <span className="font-bold text-gray-700">
                {annonce.nb_sujets_restants.toLocaleString()} {tx.sujets}
              </span>
              <span className="text-gray-500">·</span>
              <span className="font-bold text-gray-700">{annonce.poids_moyen} {tx.poids}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500">
                {annonce.eleveur?.prenom} {annonce.eleveur?.nom?.[0]}.
              </span>
            </div>
          </div>
        )}

        {/* Cours du jour */}
        {cours && (
          <div className="card border-l-4 border-kourti-green">
            <p className="text-xs text-gray-400 mb-1">{tx.coursJour}</p>
            <p className="text-xl font-bold text-kourti-green">
              {cours.prix_min} — {cours.prix_max} DA/kg
            </p>
          </div>
        )}

        {/* Acceptation immédiate — tap pour offrir ce prix */}
        {annonce?.prix_acceptation_auto && (
          <button
            onClick={() => setPrix(String(annonce.prix_acceptation_auto))}
            className="card w-full bg-yellow-50 border-2 border-yellow-300 flex items-center justify-between text-left"
          >
            <div>
              <p className="text-xs text-yellow-700 font-bold">
                ⚡ {lang === 'fr' ? 'Acceptation immédiate' : 'قبول فوري'}
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">
                {lang === 'fr'
                  ? 'Touchez pour offrir ce prix — vente conclue sur le champ (chargement sous 48 h)'
                  : 'المس لعرض هذا السعر — تُقبل الصفقة فوراً (تحميل خلال 48 سا)'}
              </p>
            </div>
            <p className="text-2xl font-black text-yellow-700 whitespace-nowrap">
              {annonce.prix_acceptation_auto}
            </p>
          </button>
        )}

        {/* Meilleure offre à dépasser */}
        {meilleure !== null && (
          <div className="card border-l-4 border-kourti-orange bg-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-semibold mb-1">
                  ⭐ {lang === 'fr' ? 'Meilleure offre actuelle' : 'أفضل عرض حالي'}
                </p>
                <p className="text-2xl font-black text-kourti-orange">
                  {meilleure} <span className="text-sm font-normal text-gray-500">DA/kg</span>
                </p>
              </div>
              <p className="text-xs text-gray-500 text-left max-w-[40%]">
                {lang === 'fr'
                  ? 'Proposez un prix supérieur pour prendre la tête'
                  : 'اقترح سعراً أعلى لتتصدر المزايدة'}
              </p>
            </div>
          </div>
        )}

        {/* Quantité souhaitée */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">{tx.quantite}</p>
          <div className="flex gap-3">
            <input
              type="number"
              inputMode="numeric"
              placeholder={tx.quantitePlaceh}
              value={quantite}
              onChange={e => setQuantite(e.target.value)}
              className="input-field text-center text-2xl font-bold flex-1"
            />
            {annonce && (
              <button
                onClick={() => setQuantite(String(annonce.nb_sujets_restants))}
                className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap"
              >
                {tx.totalLot}
              </button>
            )}
          </div>
        </div>

        {/* Saisie prix — paliers ±5 pour éviter le clavier */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">{tx.prix}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => ajusterPrix(-5)}
              className="w-14 h-14 rounded-2xl text-lg font-bold border-2 border-gray-200 text-gray-600 active:scale-95 shrink-0"
            >
              −5
            </button>
            <input
              type="number"
              inputMode="numeric"
              placeholder={tx.prixPlaceh}
              value={prix}
              onChange={e => setPrix(e.target.value)}
              className="input-field text-center text-3xl font-bold flex-1 min-w-0"
            />
            <button
              onClick={() => ajusterPrix(5)}
              className="w-14 h-14 rounded-2xl text-lg font-bold text-white active:scale-95 shrink-0 bg-kourti-orange"
            >
              +5
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">DA/kg</p>

          {/* Indicateur marché */}
          {indStyle && (
            <div className={`mt-3 ${indStyle.bg} rounded-xl px-4 py-2 flex items-center justify-between`}>
              <span className="text-sm text-gray-500">{tx.indicateur}</span>
              <span className={`text-lg font-bold ${indStyle.color}`}>
                {indicateur} <span className="text-sm font-normal">{indStyle.label}</span>
              </span>
            </div>
          )}
        </div>

        {/* Mode de paiement */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">{tx.modePaie}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setModePaie('cash')}
              className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all
                ${modePaie === 'cash'
                  ? 'bg-kourti-orange text-white shadow-md'
                  : 'bg-gray-100 text-gray-500'}`}
            >
              {tx.cash}
            </button>
            <button
              onClick={() => setModePaie('differe')}
              className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all
                ${modePaie === 'differe'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-500'}`}
            >
              {tx.credit}
            </button>
          </div>

          {/* Sélection date si différé */}
          {modePaie === 'differe' && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">{tx.datePaie}</p>
              <input
                type="date"
                value={datePaie}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={e => setDatePaie(e.target.value)}
                className="input-field text-center font-semibold"
              />
              <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2">
                <p className="text-xs text-amber-700">⚠️ {tx.avertissement}</p>
              </div>
            </div>
          )}
        </div>

        {/* Créneau de chargement — pastilles en un tap, sélecteur en secours */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">🚛 {tx.creneau}</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { j: 1, h: 8,  fr: 'Demain matin',  ar: 'غدوة الصباح' },
              { j: 1, h: 14, fr: 'Demain a.-m.',  ar: 'غدوة العشية' },
              { j: 2, h: 8,  fr: 'Après-demain',  ar: 'بعد غدوة' },
            ].map(opt => {
              const val = fmtLocal(creneauDate(opt.j, opt.h))
              const actif = creneau === val
              return (
                <button
                  key={`${opt.j}-${opt.h}`}
                  onClick={() => setCreneau(val)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                    actif
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {lang === 'fr' ? opt.fr : opt.ar}
                  <span className="block text-xs font-normal mt-0.5">{opt.h}:00</span>
                </button>
              )
            })}
          </div>
          <input
            type="datetime-local"
            value={creneau}
            onChange={e => setCreneau(e.target.value)}
            className="input-field text-center font-semibold"
            style={{ direction: 'ltr' }}
          />
          <div className="mt-3 bg-blue-50 rounded-xl px-3 py-2">
            <p className="text-xs text-blue-700">ℹ️ {tx.creneauInfo}</p>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <p className="text-red-500 text-center text-sm bg-red-50 p-3 rounded-xl">
            {error}
          </p>
        )}

        {/* Bouton envoyer */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`btn-primary py-4 text-lg ${
            modePaie === 'differe' ? 'bg-blue-600 hover:bg-blue-700' : ''
          }`}
        >
          {submitting
            ? tx.envoi
            : (offreExist ? tx.modifier : tx.envoyer)}
        </button>
 
      </div>
    </div>
  )
}

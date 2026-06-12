import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { formatDA, formatDateTime } from '../../lib/utils'
import { waLink, msgTransaction } from '../../lib/whatsapp'

const ETAPES = ['accord', 'chargement', 'pesee', 'cloture']
const DELAI_NOTE_MS = 48 * 3600 * 1000 // notes modifiables 48 h après clôture

export default function DetailTransaction() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [tx,            setTx]            = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [showReco,      setShowReco]      = useState(false)

  // Notation bilatérale (chacun note l'autre partie)
  const [noteSaisie,    setNoteSaisie]    = useState(0)
  const [noteSauvee,    setNoteSauvee]    = useState(false)

  // Annulation (éleveur uniquement, motif obligatoire)
  const [showAnnuler,   setShowAnnuler]   = useState(false)
  const [motif,         setMotif]         = useState('')

  // Champs pesée
  const [qtReelle,   setQtReelle]   = useState('')
  const [poidsTot,   setPoidsTot]   = useState('')
  const [prixReel,   setPrixReel]   = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    fr: {
      titre:         'Suivi de transaction',
      retour:        'Retour',
      etapes:        ['Accord', 'Chargement', 'Pesée', 'Clôture'],
      recoTitre:     '👍 Recommander cet acheteur ?',
      recoMsg:       "Avez-vous été satisfait de cette transaction ? Une recommandation renforce la réputation de l'acheteur.",
      recoOui:       'Oui, je recommande',
      recoNon:       'Non merci',
      eleveur:       'Éleveur',
      acheteur:      'Acheteur',
      sujets:        'sujets',
      da_kg:         'DA/kg',
      cash:          'Cash',
      differe:       'Crédit',
      montant:       'Montant total',
      chargement:    'Chargement',
      pesee:         'Pesée réelle',
      qtAccordee:    'Qté accordée',
      qtReelle:      'Qté réelle chargée (sujets)',
      poidsTot:      'Poids total pesée (kg)',
      prixReel:      'Prix/kg final (DA)',
      montantFinal:  'Montant final',
      btnCharger:    'Acheteur arrivé — Démarrer chargement',
      btnPesee:      'Saisir données de pesée',
      btnValPesee:   'Valider la pesée',
      btnPaye:       'Confirmer paiement Cash reçu ✓',
      btnPayeCredit: 'Confirmer réception du virement ✓',
      attente:       "En attente de l'éleveur",
      attenteAch:    "En attente de l'acheteur",
      creditInfo:    'Paiement à crédit — en attente de la date convenue',
      cloture:       '✓ Transaction clôturée',
      dateCh:        'Date chargement',
      loading:       'Chargement...',
      errPesee:      'Remplissez tous les champs de pesée',
      creneau:       'Passage prévu au hangar',
      retard:        '⚠️ Créneau dépassé — l\'acheteur n\'est pas venu ?',
      annulerTx:     'Annuler la transaction',
      annulerTitre:  'Annuler cette transaction ?',
      annulerMsg:    'Le stock réservé retournera dans votre annonce et les autres offres restent valables. Le motif est conservé dans l\'historique et l\'acheteur sera notifié.',
      motifLbl:      'Motif de l\'annulation (obligatoire)',
      motifs:        ['Acheteur absent au créneau', 'L\'acheteur a annulé', 'Désaccord sur place', 'Autre'],
      confirmAnnul:  'Confirmer l\'annulation',
      annulee:       'Transaction annulée',
      motifAffiche:  'Motif',
      noterTitre:    'Votre avis sur cette transaction',
      noterCible:    { eleveur: 'Notez l\'éleveur', acheteur: 'Notez l\'acheteur' },
      noteEnvoyer:   'Enregistrer ma note',
      noteModifiable:'Modifiable pendant 48 h après la clôture',
      noteDefinitive:'Note définitive',
      noteMerci:     '✓ Note enregistrée',
      recommander:   '👍 Recommander cet acheteur',
    },
    ar: {
      titre:         'متابعة الصفقة',
      retour:        'رجوع',
      etapes:        ['اتفاق', 'التحميل', 'الوزن', 'الإغلاق'],
      recoTitre:     '👍 هل توصي بهذا المشتري؟',
      recoMsg:       'هل كنت راضياً عن هذه الصفقة؟ التوصية تعزز سمعة المشتري.',
      recoOui:       'نعم، أوصي به',
      recoNon:       'لا شكراً',
      eleveur:       'المربي',
      acheteur:      'المشتري',
      sujets:        'رأس',
      da_kg:         'دج/كغ',
      cash:          'نقداً',
      differe:       'آجل',
      montant:       'المبلغ الإجمالي',
      chargement:    'التحميل',
      pesee:         'الوزن الفعلي',
      qtAccordee:    'الكمية المتفق عليها',
      qtReelle:      'الكمية الفعلية المحملة (رأس)',
      poidsTot:      'الوزن الكلي الفعلي (كغ)',
      prixReel:      'السعر النهائي/كغ (دج)',
      montantFinal:  'المبلغ النهائي',
      btnCharger:    'المشتري وصل — بدء التحميل',
      btnPesee:      'إدخال بيانات الوزن',
      btnValPesee:   'تأكيد الوزن',
      btnPaye:       'تأكيد استلام الدفع نقداً ✓',
      btnPayeCredit: 'تأكيد استلام الدفع الآجل ✓',
      attente:       'في انتظار المربي',
      attenteAch:    'في انتظار المشتري',
      creditInfo:    'دفع آجل — بانتظار تاريخ الاستحقاق',
      cloture:       '✓ تمت الصفقة',
      dateCh:        'تاريخ التحميل',
      loading:       'جاري التحميل...',
      errPesee:      'أدخل جميع بيانات الوزن',
      creneau:       'موعد التحميل المتفق عليه',
      retard:        '⚠️ تجاوز الموعد — المشتري لم يحضر؟',
      annulerTx:     'إلغاء الصفقة',
      annulerTitre:  'إلغاء هذه الصفقة؟',
      annulerMsg:    'تعود الكمية المحجوزة إلى إعلانك وتبقى العروض الأخرى صالحة. يُحفظ السبب في السجل ويُبلَّغ المشتري.',
      motifLbl:      'سبب الإلغاء (إلزامي)',
      motifs:        ['المشتري غائب في الموعد', 'المشتري ألغى', 'خلاف في عين المكان', 'سبب آخر'],
      confirmAnnul:  'تأكيد الإلغاء',
      annulee:       'صفقة ملغاة',
      motifAffiche:  'السبب',
      noterTitre:    'رأيك في هذه الصفقة',
      noterCible:    { eleveur: 'قيّم المربي', acheteur: 'قيّم المشتري' },
      noteEnvoyer:   'حفظ تقييمي',
      noteModifiable:'قابل للتعديل خلال 48 ساعة بعد الإغلاق',
      noteDefinitive:'تقييم نهائي',
      noteMerci:     '✓ تم حفظ التقييم',
      recommander:   '👍 أوصي بهذا المشتري',
    }
  }
  const tr = t[lang]

  const isEleveur  = profile?.id === tx?.eleveur_id
  const isAcheteur = profile?.id === tx?.acheteur_id
  const etapeIdx   = ETAPES.indexOf(tx?.statut_transaction || 'accord')

  useEffect(() => {
    loadTx()

    // Realtime
    const channel = supabase
      .channel(`transaction-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'transactions',
        filter: `id=eq.${id}`
      }, (payload) => {
        setTx(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const loadTx = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        offre:offres!offre_id ( prix_kg, quantite, type_paiement, date_paiement_convenue ),
        annonce:annonces!annonce_id ( wilaya, commune ),
        eleveur:users!eleveur_id ( prenom, nom, badge, phone ),
        acheteur:users!acheteur_id ( prenom, nom, badge, phone )
      `)
      .eq('id', id)
      .single()
    setTx(data)
    if (data?.prix_kg_reel) setPrixReel(String(data.prix_kg_reel))
    if (data) {
      // Ma note existante sur l'autre partie
      const maNote = data.eleveur_id === profile?.id ? data.note_acheteur : data.note_eleveur
      setNoteSaisie(maNote || 0)
      setNoteSauvee(!!maNote)
    }
    setLoading(false)
  }

  const avancer = async (updates) => {
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
    if (err) setError(err.message)
    setSaving(false)
  }

  const handleChargement = () =>
    avancer({ statut_transaction: 'chargement', date_chargement: new Date().toISOString() })

  const handleValiderPesee = () => {
    const qt = parseInt(qtReelle)
    const pt = parseFloat(poidsTot)
    const pr = parseFloat(prixReel)
    if (!qt || !pt || !pr) { setError(tr.errPesee); return }
    avancer({
      statut_transaction:    'pesee',
      quantite_reelle_pesee:  qt,
      poids_total_kg_pesee:   pt,
      prix_kg_reel:           pr,
      montant_total_reel:     pt * pr,
    })
  }

  const handleCloture = async () => {
    setSaving(true)
    setError('')

    // 1. Clôture la transaction
    await supabase.from('transactions').update({
      statut_transaction:          'cloture',
      statut_paiement:             'paye',
      date_verification_paiement:  new Date().toISOString().split('T')[0],
      date_cloture:                new Date().toISOString(),
    }).eq('id', id)

    // 2. Décrémente le stock de l'annonce + la passe en vendue si vide
    await supabase.rpc('cloturer_annonce', { p_transaction_id: id })

    // 3. Incrémente nb_transactions des deux parties
    await supabase.rpc('increment_nb_transactions', { user_id: tx.eleveur_id })
    await supabase.rpc('increment_nb_transactions', { user_id: tx.acheteur_id })

    // 4. Alimente l'Indice KOURTI (prix_marche) avec les vraies données de pesée
    const prixKg = tx.prix_kg_reel || tx.offre?.prix_kg
    const today  = new Date().toISOString().split('T')[0]
    const { data: existant } = await supabase
      .from('prix_marche')
      .select('*')
      .eq('wilaya', tx.annonce?.wilaya || '')
      .eq('date', today)
      .single()

    if (existant) {
      const nbTxMkt  = (existant.nb_transactions || 0) + 1
      const newMoyen = ((existant.prix_moyen * existant.nb_transactions) + prixKg) / nbTxMkt
      await supabase.from('prix_marche').update({
        prix_moyen:      Math.round(newMoyen * 100) / 100,
        prix_min:        Math.min(existant.prix_min || prixKg, prixKg),
        prix_max:        Math.max(existant.prix_max || prixKg, prixKg),
        nb_transactions: nbTxMkt,
        fiabilite:       'confirme',
        source:          'pesee_app',
      }).eq('id', existant.id)
    } else {
      const wilayaAnn = tx.annonce?.wilaya
      if (wilayaAnn) {
        await supabase.from('prix_marche').insert({
          wilaya:          wilayaAnn,
          prix_min:        prixKg,
          prix_max:        prixKg,
          prix_moyen:      prixKg,
          nb_transactions: 1,
          fiabilite:       'confirme',
          source:          'pesee_app',
          date:            today,
        })
      }
    }

    setSaving(false)
    // 5. Si éleveur → proposer recommandation de l'acheteur
    if (isEleveur) setShowReco(true)
  }

  // Annulation manuelle par l'éleveur — motif obligatoire, stock restitué,
  // historique conservé, acheteur notifié (realtime + notification globale)
  const handleAnnuler = async () => {
    if (!motif.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.rpc('annuler_transaction', {
      p_transaction_id: id,
      p_motif:          motif.trim(),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAnnuler(false)
    loadTx()
  }

  // Notation bilatérale : chacun note l'autre partie, modifiable 48 h
  const handleSaveNote = async () => {
    if (!noteSaisie) return
    setSaving(true)
    const champ   = isEleveur ? 'note_acheteur' : 'note_eleveur'
    const colId   = isEleveur ? 'acheteur_id'   : 'eleveur_id'
    const cibleId = isEleveur ? tx.acheteur_id  : tx.eleveur_id

    await supabase.from('transactions').update({ [champ]: noteSaisie }).eq('id', id)

    // Recalcule la moyenne de la personne notée
    const { data: notes } = await supabase
      .from('transactions')
      .select(champ)
      .eq(colId, cibleId)
      .not(champ, 'is', null)
    if (notes?.length) {
      const moy = notes.reduce((s, n) => s + n[champ], 0) / notes.length
      await supabase.from('users')
        .update({ note_moyenne: Math.round(moy * 100) / 100 })
        .eq('id', cibleId)
    }

    setTx(prev => ({ ...prev, [champ]: noteSaisie }))
    setNoteSauvee(true)
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
      <p className="text-gray-400">{tr.loading}</p>
    </div>
  )

  if (!tx) return (
    <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
      <p className="text-gray-400">Transaction introuvable</p>
    </div>
  )

  const montantFinal = tx.montant_total_reel
  const estAnnulee   = tx.statut_transaction === 'annulee'

  // Créneau de chargement dépassé sans que le chargement ait démarré ?
  const creneauDepasse = tx.statut_transaction === 'accord' &&
    tx.date_chargement_prevue && new Date(tx.date_chargement_prevue) < new Date()

  // Fenêtre de notation : 48 h après la clôture, puis définitive
  const clotureAt = tx.date_cloture || tx.date_verification_paiement || tx.created_at
  const noteEditable = tx.statut_transaction === 'cloture' &&
    (Date.now() - new Date(clotureAt).getTime()) < DELAI_NOTE_MS

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-10">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(isEleveur ? '/eleveur' : '/acheteur')}
          className="text-white text-xl px-1"
        >←</button>
        <h1 className="text-xl font-bold flex-1">{tr.titre}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Transaction annulée — bannière + motif (historique) */}
        {estAnnulee && (
          <div className="card bg-red-50 border-2 border-red-300 text-center py-5">
            <div className="text-4xl mb-2">🚫</div>
            <p className="font-bold text-red-700 text-lg">{tr.annulee}</p>
            {tx.date_annulation && (
              <p className="text-xs text-red-400 mt-1">
                {new Date(tx.date_annulation).toLocaleString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ')}
              </p>
            )}
            {tx.motif_annulation && (
              <div className="mt-3 bg-white rounded-xl px-4 py-2 inline-block">
                <p className="text-xs text-gray-400">{tr.motifAffiche}</p>
                <p className="text-sm font-semibold text-gray-700">{tx.motif_annulation}</p>
              </div>
            )}
          </div>
        )}

        {/* Stepper */}
        {!estAnnulee && (
        <div className="card">
          <div className="flex items-center justify-between">
            {tr.etapes.map((label, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${i < etapeIdx  ? 'bg-kourti-orange text-white'
                  : i === etapeIdx ? 'bg-kourti-orange text-white ring-4 ring-green-200'
                  : 'bg-gray-200 text-gray-400'}`}>
                  {i < etapeIdx ? '✓' : i + 1}
                </div>
                <p className={`text-xs mt-1 text-center leading-tight
                  ${i <= etapeIdx ? 'text-kourti-green font-semibold' : 'text-gray-400'}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
          {/* Barre de progression */}
          <div className="relative mt-2 h-1 bg-gray-200 rounded-full mx-4">
            <div
              className="absolute top-0 left-0 h-1 bg-kourti-orange rounded-full transition-all"
              style={{ width: `${(Math.max(0, etapeIdx) / (ETAPES.length - 1)) * 100}%` }}
            />
          </div>
        </div>
        )}

        {/* Créneau de chargement convenu */}
        {tx.date_chargement_prevue && !estAnnulee && tx.statut_transaction !== 'cloture' && (
          <div className={`card ${creneauDepasse ? 'bg-red-50 border-2 border-red-200' : 'bg-amber-50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700">🚛 {tr.creneau}</p>
              <p className="font-bold text-gray-800">
                {formatDateTime(tx.date_chargement_prevue, lang)}
              </p>
            </div>
            {creneauDepasse && isEleveur && (
              <p className="text-xs text-red-600 font-semibold mt-2">{tr.retard}</p>
            )}
          </div>
        )}

        {/* Résumé de l'accord */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase">
            {lang === 'fr' ? 'Accord initial' : 'الاتفاق الأولي'}
          </p>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-kourti-green">{tx.offre?.prix_kg}</p>
              <p className="text-xs text-gray-400">{tr.da_kg}</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-700">{tx.quantite_accordee?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{tr.sujets}</p>
            </div>
            <div className={`flex-1 rounded-xl p-3 text-center ${
              tx.offre?.type_paiement === 'cash' ? 'bg-green-50' : 'bg-blue-50'}`}>
              <p className={`text-sm font-bold ${
                tx.offre?.type_paiement === 'cash' ? 'text-green-700' : 'text-blue-700'}`}>
                {tx.offre?.type_paiement === 'cash' ? `💵 ${tr.cash}` : `📅 ${tr.differe}`}
              </p>
              {tx.offre?.type_paiement === 'differe' && (
                <p className="text-xs text-blue-500 mt-0.5">{tx.offre.date_paiement_convenue}</p>
              )}
            </div>
          </div>

          {/* Parties + téléphone cliquable */}
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-lg">🏚️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{tr.eleveur}</p>
                <button
                  onClick={() => navigate(`/profil/${tx.eleveur_id}`)}
                  className="text-sm font-semibold text-gray-700 underline decoration-dotted"
                >
                  {tx.eleveur?.prenom} {tx.eleveur?.nom?.[0]}.
                </button>
                {isAcheteur && tx.eleveur?.phone && (
                  <div className="flex flex-col gap-1 mt-1">
                    <a
                      href={`tel:${tx.eleveur.phone}`}
                      className="flex items-center gap-1 text-xs font-bold text-white px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#166534' }}
                    >
                      📞 {tx.eleveur.phone}
                    </a>
                    <a
                      href={waLink(tx.eleveur.phone, msgTransaction(tx, lang))}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-white px-2 py-1 rounded-lg bg-green-500"
                    >
                      🟢 WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-lg">🛒</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{tr.acheteur}</p>
                <button
                  onClick={() => navigate(`/profil/${tx.acheteur_id}`)}
                  className="text-sm font-semibold text-gray-700 underline decoration-dotted"
                >
                  {tx.acheteur?.prenom} {tx.acheteur?.nom?.[0]}.
                </button>
                {isEleveur && tx.acheteur?.phone && (
                  <div className="flex flex-col gap-1 mt-1">
                    <a
                      href={`tel:${tx.acheteur.phone}`}
                      className="flex items-center gap-1 text-xs font-bold text-white px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#E85C0D' }}
                    >
                      📞 {tx.acheteur.phone}
                    </a>
                    <a
                      href={waLink(tx.acheteur.phone, msgTransaction(tx, lang))}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-white px-2 py-1 rounded-lg bg-green-500"
                    >
                      🟢 WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Étape 2 : Chargement */}
        {etapeIdx >= 1 && (
          <div className="card">
            <p className="text-xs text-gray-400 font-medium mb-2 uppercase">{tr.chargement}</p>
            <p className="text-sm text-gray-600">
              📅 {tx.date_chargement
                ? new Date(tx.date_chargement).toLocaleString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ')
                : '—'}
            </p>
          </div>
        )}

        {/* Étape 3 : Pesée */}
        {etapeIdx >= 2 && (
          <div className="card">
            <p className="text-xs text-gray-400 font-medium mb-3 uppercase">{tr.pesee}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-700">
                  {tx.quantite_reelle_pesee?.toLocaleString() || '—'}
                </p>
                <p className="text-xs text-gray-400">{tr.sujets}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-700">
                  {tx.poids_total_kg_pesee ? `${tx.poids_total_kg_pesee} kg` : '—'}
                </p>
                <p className="text-xs text-gray-400">Poids total</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-kourti-green">
                  {tx.prix_kg_reel || '—'}
                </p>
                <p className="text-xs text-gray-400">{tr.da_kg}</p>
              </div>
            </div>
            {tx.montant_total_reel && (
              <div className="mt-3 bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">{tr.montantFinal}</p>
                <p className="text-2xl font-bold text-kourti-green">
                  {formatDA(tx.montant_total_reel)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Clôture */}
        {tx.statut_transaction === 'cloture' && (
          <div className="card bg-green-50 border-2 border-green-400 text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-bold text-green-700 text-xl">{tr.cloture}</p>
            {montantFinal && (
              <p className="text-kourti-green font-bold text-2xl mt-2">
                {formatDA(montantFinal)}
              </p>
            )}
            <button
              onClick={() => navigate(isEleveur ? '/eleveur' : '/acheteur')}
              className="mt-5 btn-primary"
            >
              {lang === 'fr' ? "🏠 Retour à l'accueil" : '🏠 العودة للرئيسية'}
            </button>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <p className="text-red-500 text-center text-sm bg-red-50 p-3 rounded-xl">{error}</p>
        )}

        {/* === ACTIONS SELON ÉTAPE ET RÔLE === */}

        {/* Étape 1 → 2 : L'éleveur confirme l'arrivée de l'acheteur et démarre le chargement */}
        {tx.statut_transaction === 'accord' && isEleveur && (
          <button onClick={handleChargement} disabled={saving} className="btn-primary py-4">
            🚛 {tr.btnCharger}
          </button>
        )}
        {tx.statut_transaction === 'accord' && isAcheteur && (
          <div className="text-center py-4 text-gray-400 text-sm">{tr.attente}</div>
        )}

        {/* Étape 2 → 3 : L'éleveur saisit les données de pesée après chargement */}
        {tx.statut_transaction === 'chargement' && isEleveur && (
          <div className="card space-y-4">
            <p className="font-semibold text-gray-700">{tr.btnPesee}</p>
            <div>
              <p className="text-sm text-gray-500 mb-1">{tr.qtReelle}</p>
              <input type="number" inputMode="numeric" value={qtReelle}
                onFocus={e => e.target.select()}
                onChange={e => setQtReelle(e.target.value)}
                placeholder={`≈ ${tx.quantite_accordee}`}
                className="input-field text-center text-xl font-bold" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">{tr.poidsTot}</p>
              <input type="number" inputMode="decimal" value={poidsTot}
                onFocus={e => e.target.select()}
                onChange={e => setPoidsTot(e.target.value)}
                placeholder="Ex: 7250.5"
                className="input-field text-center text-xl font-bold" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">{tr.prixReel}</p>
              <input type="number" inputMode="numeric" value={prixReel}
                onFocus={e => e.target.select()}
                onChange={e => setPrixReel(e.target.value)}
                placeholder={`≈ ${tx.offre?.prix_kg}`}
                className="input-field text-center text-xl font-bold" />
            </div>
            {poidsTot && prixReel && (
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">{tr.montantFinal}</p>
                <p className="text-2xl font-bold text-kourti-green">
                  {formatDA(parseFloat(poidsTot) * parseFloat(prixReel))}
                </p>
              </div>
            )}
            <button onClick={handleValiderPesee} disabled={saving} className="btn-primary py-4">
              ⚖️ {tr.btnValPesee}
            </button>
          </div>
        )}
        {tx.statut_transaction === 'chargement' && isAcheteur && (
          <div className="text-center py-4 text-gray-400 text-sm">{tr.attente}</div>
        )}

        {/* Étape 3 → 4 : Clôture paiement
            Cash   → l'éleveur confirme réception du cash en main
            Crédit → l'éleveur confirme réception du virement à la date convenue
            Dans les deux cas c'est l'éleveur qui a le pouvoir de clôture */}
        {tx.statut_transaction === 'pesee' && isEleveur && tx.offre?.type_paiement === 'cash' && (
          <button onClick={handleCloture} disabled={saving}
            className="btn-primary py-4" style={{ backgroundColor: '#166534' }}>
            💵 {tr.btnPaye}
          </button>
        )}
        {tx.statut_transaction === 'pesee' && isEleveur && tx.offre?.type_paiement === 'differe' && (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-blue-500 mb-1">{tr.creditInfo}</p>
              <p className="font-bold text-blue-700">
                {tx.offre.date_paiement_convenue
                  ? new Date(tx.offre.date_paiement_convenue).toLocaleDateString(
                      lang === 'fr' ? 'fr-DZ' : 'ar-DZ'
                    )
                  : '—'}
              </p>
            </div>
            <button onClick={handleCloture} disabled={saving}
              className="btn-primary py-4 bg-blue-600">
              📅 {tr.btnPayeCredit}
            </button>
          </div>
        )}
        {tx.statut_transaction === 'pesee' && isAcheteur && (
          <div className="text-center py-4 text-gray-400 text-sm">
            {tx.offre?.type_paiement === 'differe' ? tr.creditInfo : tr.attenteAch}
          </div>
        )}

        {/* Annulation manuelle — éleveur uniquement, avant la pesée */}
        {isEleveur && ['accord', 'chargement'].includes(tx.statut_transaction) && (
          <button
            onClick={() => setShowAnnuler(true)}
            className={`w-full py-3 rounded-xl text-sm font-semibold border-2 ${
              creneauDepasse
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-red-200 text-red-500 bg-white'
            }`}
          >
            🚫 {tr.annulerTx}
          </button>
        )}

        {/* Notation bilatérale — toujours accessible après clôture, 48 h pour modifier */}
        {tx.statut_transaction === 'cloture' && (
          <div className="card border-2 border-yellow-200">
            <p className="font-bold text-gray-800 mb-1">⭐ {tr.noterTitre}</p>
            <p className="text-xs text-gray-400 mb-4">
              {noteEditable ? tr.noteModifiable : tr.noteDefinitive}
            </p>

            <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                isEleveur ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-kourti-green'
              }`}>
                {(isEleveur ? tx.acheteur : tx.eleveur)?.prenom?.[0]}
              </div>
              <p className="font-semibold text-gray-700 text-sm">
                {tr.noterCible[isEleveur ? 'acheteur' : 'eleveur']} —{' '}
                {(isEleveur ? tx.acheteur : tx.eleveur)?.prenom}{' '}
                {(isEleveur ? tx.acheteur : tx.eleveur)?.nom?.[0]}.
              </p>
            </div>

            {/* Étoiles */}
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  disabled={!noteEditable}
                  onClick={() => { setNoteSaisie(n); setNoteSauvee(false) }}
                  className={`text-4xl transition-transform ${
                    noteSaisie >= n ? 'scale-110' : 'opacity-30'
                  } ${!noteEditable ? 'cursor-default' : ''}`}
                >
                  ⭐
                </button>
              ))}
            </div>

            {noteEditable && (
              <button
                disabled={noteSaisie === 0 || noteSauvee || saving}
                onClick={handleSaveNote}
                className="btn-primary py-3 disabled:opacity-40"
              >
                {noteSauvee ? tr.noteMerci : saving ? '...' : tr.noteEnvoyer}
              </button>
            )}

            {/* L'éleveur peut aussi recommander l'acheteur */}
            {isEleveur && (
              <button
                onClick={() => setShowReco(true)}
                className="w-full mt-2 py-3 rounded-xl text-sm font-semibold border-2 border-green-200 text-kourti-green bg-white"
              >
                {tr.recommander}
              </button>
            )}
          </div>
        )}

      </div>

      {/* Modal annulation — motif obligatoire, conservé dans l'historique */}
      {showAnnuler && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl px-6 py-8">
            <p className="font-bold text-gray-800 text-xl mb-2">🚫 {tr.annulerTitre}</p>
            <p className="text-gray-500 text-sm mb-5">{tr.annulerMsg}</p>

            <p className="text-sm font-semibold text-gray-600 mb-2">{tr.motifLbl}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {tr.motifs.map(m => (
                <button
                  key={m}
                  onClick={() => setMotif(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    motif === m
                      ? 'border-red-400 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              value={motif}
              onChange={e => setMotif(e.target.value.slice(0, 200))}
              rows={2}
              className="input-field resize-none mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowAnnuler(false)}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold"
              >
                {lang === 'fr' ? 'Retour' : 'رجوع'}
              </button>
              <button
                disabled={!motif.trim() || saving}
                onClick={handleAnnuler}
                className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold disabled:opacity-40"
              >
                {saving ? '...' : tr.confirmAnnul}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal recommandation (après clôture, côté éleveur) */}
      {showReco && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl px-6 py-8">
            <p className="font-bold text-gray-800 text-xl mb-2">{tr.recoTitre}</p>
            <p className="text-gray-500 text-sm mb-4">{tr.recoMsg}</p>

            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center
                              font-bold text-blue-600 text-lg">
                {tx.acheteur?.prenom?.[0]}
              </div>
              <div>
                <p className="font-bold text-gray-800">
                  {tx.acheteur?.prenom} {tx.acheteur?.nom?.[0]}.
                </p>
                <p className="text-sm text-gray-400">
                  {montantFinal ? formatDA(montantFinal) : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowReco(false); navigate('/eleveur') }}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold"
              >
                {tr.recoNon}
              </button>
              <button
                onClick={async () => {
                  await supabase.from('recommandations').upsert({
                    eleveur_id:     tx.eleveur_id,
                    acheteur_id:    tx.acheteur_id,
                    transaction_id: id,
                    active:         true,
                  }, { onConflict: 'eleveur_id,acheteur_id' })

                  const { count: recoCount } = await supabase
                    .from('recommandations')
                    .select('*', { count: 'exact', head: true })
                    .eq('acheteur_id', tx.acheteur_id)
                    .eq('active', true)

                  const nb = recoCount || 0
                  const { data: acheteurData } = await supabase
                    .from('users')
                    .select('nb_transactions')
                    .eq('id', tx.acheteur_id)
                    .single()

                  const nbTxAch = acheteurData?.nb_transactions || 0
                  let badgeVal  = 'actif'
                  if (nbTxAch >= 20 && nb >= 5) badgeVal = 'reference'
                  else if (nbTxAch >= 10 && nb >= 3) badgeVal = 'fiable'
                  else if (nbTxAch >= 3  && nb >= 1) badgeVal = 'confirme'

                  await supabase.from('users')
                    .update({ nb_recommandations_recues: nb, badge: badgeVal })
                    .eq('id', tx.acheteur_id)

                  setShowReco(false)
                  navigate('/eleveur')
                }}
                className="flex-1 py-4 bg-kourti-orange text-white rounded-xl font-bold"
              >
                👍 {tr.recoOui}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

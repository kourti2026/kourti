import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { offreIndicateur, tauxPresence, formatDA, formatDateTime, tempsRestant } from '../../lib/utils'
import { calcSerie } from '../../lib/serieUtils'
import { expirerOffres } from '../../lib/publication'

export default function OffresEleveur() {
  const { profile }         = useAuth()
  const navigate            = useNavigate()
  const [annonce, setAnnonce] = useState(null)
  const [offres,  setOffres]  = useState([])
  const [cours,   setCours]   = useState(null)
  const [coutJour, setCoutJour] = useState(0)   // coût d'attente DA/jour (série liée)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [action,  setAction]  = useState(null) // { type: 'accepter'|'refuser'|'contre', offre }
  const [contrePrix, setContrePrix] = useState('')
  const [contreQte,  setContreQte]  = useState('')
  const [error,   setError]   = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      titre:        'العروض المستلمة',
      pasOffres:    'لم تصل أي عروض بعد',
      pasAnnonce:   'ليس لديك إعلان نشط',
      sujets:       'رأس',
      da_kg:        'دج/كغ',
      cash:         'نقداً',
      differe:      'آجل حتى',
      accepter:     'قبول',
      refuser:      'رفض',
      proposer:     'اقتراح سعر',
      confirmer:    'تأكيد القبول',
      annuler:      'إلغاء',
      confRefus:    'تأكيد الرفض',
      msgAccepter:  'بقبول هذا العرض تُحجز الكمية فوراً. العروض الأخرى تبقى صالحة للكمية المتبقية.',
      msgRefuser:   'هل تريد رفض هذا العرض؟',
      contreTitre:  'اقتراح مضاد',
      contreMsg:    'اقترح سعرك (والكمية اختياريا) — يصل الاقتراح للمشتري ليقبله أو يرفضه.',
      contrePrix:   'سعرك المقترح (دج/كغ)',
      contreQte:    'الكمية (اختياري)',
      contreEnvoyer:'إرسال الاقتراح',
      contreEnvoye: 'اقتراح مرسل',
      enAttenteRep: 'بانتظار رد المشتري',
      transactions: 'صفقة',
      fiabilite:    'موثوقية',
      presence:     'حضور',
      coursJour:    'سعر اليوم',
      creneau:      'موعد التحميل',
      coutAttente:  'كلفة الانتظار التقديرية',
      restants:     'المتبقي للبيع',
      chargement:   'جاري التحميل...',
      errMax:       'لديك 3 صفقات جارية — أغلق واحدة قبل قبول عرض جديد.',
      errStock:     'لا يوجد مخزون متبقي في الإعلان.',
      nouveau:      'جديد',
      actif:        'نشط',
      confirme:     'موثوق ✓',
      fiable_b:     'موثوق ⭐',
      reference:    'مرجع 👑',
    },
    fr: {
      titre:        'Offres reçues',
      pasOffres:    'Aucune offre reçue pour le moment',
      pasAnnonce:   'Aucune annonce active',
      sujets:       'sujets',
      da_kg:        'DA/kg',
      cash:         'Cash',
      differe:      'Crédit jusqu\'au',
      accepter:     'Accepter',
      refuser:      'Refuser',
      proposer:     'Proposer',
      confirmer:    'Confirmer l\'acceptation',
      annuler:      'Annuler',
      confRefus:    'Confirmer le refus',
      msgAccepter:  'En acceptant, la quantité est réservée immédiatement. Les autres offres restent valables pour le stock restant.',
      msgRefuser:   'Voulez-vous refuser cette offre ?',
      contreTitre:  'Contre-offre',
      contreMsg:    'Proposez votre prix (et une quantité, optionnel) — l\'acheteur pourra accepter ou refuser.',
      contrePrix:   'Votre prix proposé (DA/kg)',
      contreQte:    'Quantité (optionnel)',
      contreEnvoyer:'Envoyer la proposition',
      contreEnvoye: 'Contre-offre envoyée',
      enAttenteRep: 'En attente de la réponse de l\'acheteur',
      transactions: 'transaction(s)',
      fiabilite:    'fiabilité',
      presence:     'présence',
      coursJour:    'Cours du jour',
      creneau:      'Passage au hangar',
      coutAttente:  'Coût d\'attente estimé',
      restants:     'Restant à vendre',
      chargement:   'Chargement...',
      errMax:       'Vous avez déjà 3 transactions en cours — clôturez-en une avant d\'accepter une nouvelle offre.',
      errStock:     'Plus de stock disponible sur cette annonce.',
      nouveau:      'Nouveau',
      actif:        'Actif',
      confirme:     'Confirmé ✓',
      fiable_b:     'Fiable ⭐',
      reference:    'Référence 👑',
    }
  }
  const tx = t[lang]

  useEffect(() => { loadData() }, [profile])

  const loadData = async () => {
    if (!profile) return
    setLoading(true)

    // Balaye les offres expirées : on ne montre que des offres vivantes
    await expirerOffres()

    // Annonce active de l'éleveur
    const { data: ann } = await supabase
      .from('annonces')
      .select('*')
      .eq('eleveur_id', profile.id)
      .eq('statut', 'active')
      .limit(1)
      .maybeSingle()

    setAnnonce(ann)

    if (ann) {
      const [{ data: offresData }, { data: coursData }] = await Promise.all([
        // Offres en attente + contre-offres envoyées, avec profil acheteur
        supabase
          .from('offres')
          .select(`
            *,
            acheteur:users!acheteur_id (
              id, prenom, nom, wilaya, commune,
              nb_transactions, nb_annulations, note_moyenne, badge
            )
          `)
          .eq('annonce_id', ann.id)
          .in('statut', ['en_attente', 'contre_offre'])
          .order('prix_kg', { ascending: false }),
        supabase
          .from('prix_marche')
          .select('*')
          .eq('wilaya', ann.wilaya)
          .eq('date', new Date().toISOString().split('T')[0])
          .maybeSingle(),
      ])
      setOffres(offresData || [])
      setCours(coursData)

      // Coût journalier de la série liée → coût d'attente par créneau
      if (ann.bande_id) {
        const [{ data: b }, { data: j }, { data: p }] = await Promise.all([
          supabase.from('bandes').select('*').eq('id', ann.bande_id).maybeSingle(),
          supabase.from('bande_jours').select('*').eq('bande_id', ann.bande_id),
          supabase.from('bande_pesees').select('*').eq('bande_id', ann.bande_id),
        ])
        if (b) setCoutJour(calcSerie(b, j || [], p || []).coutJour || 0)
      }
    }

    setLoading(false)
  }

  const handleAccepter = async (offre) => {
    setSaving(true); setError('')
    const { data: txId, error: err } = await supabase.rpc('accepter_offre', {
      p_offre_id: offre.id,
    })
    setSaving(false)
    setAction(null)
    if (err) {
      if (err.message?.includes('MAX_TRANSACTIONS')) setError(tx.errMax)
      else if (err.message?.includes('STOCK_EPUISE')) setError(tx.errStock)
      else setError(err.message)
      return
    }
    navigate(txId ? `/transaction/${txId}` : '/eleveur')
  }

  const handleRefuser = async (offre) => {
    await supabase.from('offres').update({ statut: 'refusee' }).eq('id', offre.id)
    setAction(null)
    setOffres(prev => prev.filter(o => o.id !== offre.id))
  }

  const handleContreOffre = async (offre) => {
    const prixNum = parseFloat(contrePrix)
    if (!prixNum || prixNum <= 0) return
    setSaving(true)
    await supabase.from('offres').update({
      statut:          'contre_offre',
      contre_prix_kg:  prixNum,
      contre_quantite: contreQte ? parseInt(contreQte) : null,
      contre_date:     new Date().toISOString(),
      // L'acheteur a 24 h pour répondre, sinon la contre-offre expire
      expires_at:      new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }).eq('id', offre.id)
    setSaving(false)
    setAction(null)
    setContrePrix(''); setContreQte('')
    loadData()
  }

  const badgeAcheteur = (badge) => {
    const map = {
      nouveau:   { label: tx.nouveau,   color: 'bg-gray-100 text-gray-600' },
      actif:     { label: tx.actif,     color: 'bg-blue-100 text-blue-600' },
      confirme:  { label: tx.confirme,  color: 'bg-green-100 text-green-700' },
      fiable:    { label: tx.fiable_b,  color: 'bg-emerald-100 text-emerald-700' },
      reference: { label: tx.reference, color: 'bg-yellow-100 text-yellow-700' },
    }
    return map[badge] || map.nouveau
  }

  const indConfig = {
    '↑↑': { color: 'text-green-600', bg: 'bg-green-50' },
    '↑':  { color: 'text-green-500', bg: 'bg-green-50' },
    '→':  { color: 'text-blue-500',  bg: 'bg-blue-50'  },
    '↓':  { color: 'text-orange-500',bg: 'bg-orange-50'},
    '↓↓': { color: 'text-red-500',   bg: 'bg-red-50'   },
  }

  // Jours d'attente jusqu'au créneau → coût aliment/gaz pour l'éleveur
  const coutAttente = (offre) => {
    if (!offre.date_chargement_prevue || !coutJour) return null
    const jours = Math.max(0, Math.ceil(
      (new Date(offre.date_chargement_prevue) - Date.now()) / 86400000
    ))
    return { jours, cout: jours * coutJour }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">{tx.chargement}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-10">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate('/eleveur')} className="text-white text-xl">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{tx.titre}</h1>
          {offres.length > 0 && (
            <p className="text-green-200 text-sm">{offres.length} offre(s)</p>
          )}
        </div>
        {annonce && (
          <div className="text-right">
            <p className="text-xs text-orange-200">{tx.restants}</p>
            <p className="font-bold">{annonce.nb_sujets_restants?.toLocaleString()} {tx.sujets}</p>
          </div>
        )}
      </div>

      {/* Cours du jour */}
      {cours && (
        <div className="mx-4 mt-4 bg-white rounded-2xl px-4 py-3 flex justify-between items-center shadow-sm">
          <span className="text-xs text-gray-400">{tx.coursJour}</span>
          <span className="font-bold text-kourti-green">
            {cours.prix_min} — {cours.prix_max} DA/kg
          </span>
        </div>
      )}

      {error && (
        <p className="mx-4 mt-4 text-red-500 text-center text-sm bg-red-50 p-3 rounded-xl">{error}</p>
      )}

      <div className="px-4 py-4 space-y-4">
        {!annonce ? (
          <div className="text-center py-20 text-gray-400">{tx.pasAnnonce}</div>
        ) : offres.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-400">{tx.pasOffres}</p>
          </div>
        ) : (
          offres.map((offre, idx) => {
            const ind      = cours ? offreIndicateur(offre.prix_kg, cours.prix_min, cours.prix_max).icon : null
            const indStyle = ind ? indConfig[ind] : null
            const bAch     = badgeAcheteur(offre.acheteur?.badge)
            const estMeilleure = idx === 0 // triées par prix desc
            const attente  = coutAttente(offre)
            const presence = tauxPresence(offre.acheteur)
            const enContre = offre.statut === 'contre_offre'
            const restant  = tempsRestant(offre.expires_at, lang)

            return (
              <div
                key={offre.id}
                className={`card ${estMeilleure ? 'border-2 border-kourti-green' : ''} ${enContre ? 'opacity-90' : ''}`}
              >
                {estMeilleure && (
                  <div className="bg-kourti-orange text-white text-xs font-bold px-3 py-1
                                  rounded-full inline-block mb-3">
                    {lang === 'fr' ? '⭐ Meilleure offre' : '⭐ أفضل عرض'}
                  </div>
                )}

                {/* Prix + indicateur + expiration */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-3xl font-bold text-kourti-green">
                    {offre.prix_kg} <span className="text-base font-normal text-gray-500">{tx.da_kg}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {restant && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                        ⏳ {restant}
                      </span>
                    )}
                    {indStyle && (
                      <span className={`text-lg font-bold px-3 py-1 rounded-full ${indStyle.bg} ${indStyle.color}`}>
                        {ind}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantité + paiement */}
                <div className="flex gap-3 mb-3">
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1 text-center">
                    <p className="font-bold text-gray-700">{offre.quantite.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{tx.sujets}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 flex-1 text-center ${
                    offre.type_paiement === 'cash' ? 'bg-green-50' : 'bg-blue-50'
                  }`}>
                    <p className={`font-bold text-sm ${
                      offre.type_paiement === 'cash' ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {offre.type_paiement === 'cash'
                        ? `💵 ${tx.cash}`
                        : `📅 ${tx.differe}`}
                    </p>
                    {offre.type_paiement === 'differe' && offre.date_paiement_convenue && (
                      <p className="text-xs text-blue-500 mt-0.5">{offre.date_paiement_convenue}</p>
                    )}
                  </div>
                </div>

                {/* Créneau de chargement + coût d'attente */}
                {offre.date_chargement_prevue && (
                  <div className="bg-amber-50 rounded-xl px-3 py-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">🚛 {tx.creneau}</span>
                      <span className="text-sm font-bold text-amber-800">
                        {formatDateTime(offre.date_chargement_prevue, lang)}
                      </span>
                    </div>
                    {attente && attente.jours > 0 && (
                      <p className="text-xs text-amber-600 mt-1 text-left">
                        ⏳ {tx.coutAttente} : ~{formatDA(attente.cout)} ({attente.jours} j)
                      </p>
                    )}
                  </div>
                )}

                {/* Profil acheteur */}
                <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                                  font-bold text-blue-600">
                    {offre.acheteur?.prenom?.[0]}
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => navigate(`/profil/${offre.acheteur?.id}`)}
                      className="font-medium text-gray-700 text-sm underline decoration-dotted"
                    >
                      {offre.acheteur?.prenom} {offre.acheteur?.nom?.[0]}.
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${bAch.color}`}>
                        {bAch.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {offre.acheteur?.nb_transactions || 0} {tx.transactions}
                      </span>
                      {presence !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          presence >= 80 ? 'bg-green-50 text-green-700'
                          : presence >= 50 ? 'bg-orange-50 text-orange-600'
                          : 'bg-red-50 text-red-600'
                        }`}>
                          🚩 {presence}% {tx.presence}
                        </span>
                      )}
                    </div>
                  </div>
                  {offre.acheteur?.note_moyenne > 0 && (
                    <div className="text-center">
                      <p className="font-bold text-sm text-gray-700">
                        {(offre.acheteur.note_moyenne / 5 * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-400">{tx.fiabilite}</p>
                    </div>
                  )}
                </div>

                {/* Contre-offre en attente de réponse */}
                {enContre ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-sm font-bold text-purple-700">
                      📨 {tx.contreEnvoye} : {offre.contre_prix_kg} {tx.da_kg}
                      {offre.contre_quantite ? ` · ${offre.contre_quantite.toLocaleString()} ${tx.sujets}` : ''}
                    </p>
                    <p className="text-xs text-purple-400 mt-1">{tx.enAttenteRep}</p>
                  </div>
                ) : (
                  /* Boutons accepter / proposer / refuser */
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAction({ type: 'refuser', offre })}
                      className="flex-1 py-3 border-2 border-gray-200 text-gray-500
                                 rounded-xl font-semibold text-sm"
                    >
                      ✗ {tx.refuser}
                    </button>
                    <button
                      onClick={() => {
                        setContrePrix(String(offre.prix_kg))
                        setContreQte('')
                        setAction({ type: 'contre', offre })
                      }}
                      className="flex-1 py-3 border-2 border-purple-300 text-purple-600
                                 rounded-xl font-semibold text-sm"
                    >
                      ↔ {tx.proposer}
                    </button>
                    <button
                      onClick={() => setAction({ type: 'accepter', offre })}
                      className="flex-1 py-3 bg-kourti-orange text-white rounded-xl font-semibold text-sm"
                    >
                      ✓ {tx.accepter}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal confirmation accepter / refuser */}
      {action && action.type !== 'contre' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl px-6 py-8">
            <p className="font-bold text-gray-800 text-lg mb-2">
              {action.type === 'accepter' ? tx.confirmer : tx.confRefus}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {action.type === 'accepter' ? tx.msgAccepter : tx.msgRefuser}
            </p>

            {/* Rappel de l'offre */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <p className="text-2xl font-bold text-kourti-green mb-1">
                {action.offre.prix_kg} DA/kg
              </p>
              <p className="text-gray-500 text-sm">
                {action.offre.quantite.toLocaleString()} {tx.sujets} ·{' '}
                {action.offre.type_paiement === 'cash' ? tx.cash : tx.differe}
                {action.offre.type_paiement === 'differe' && action.offre.date_paiement_convenue
                  ? ` ${action.offre.date_paiement_convenue}` : ''}
              </p>
              {action.offre.date_chargement_prevue && (
                <p className="text-gray-500 text-sm mt-1">
                  🚛 {formatDateTime(action.offre.date_chargement_prevue, lang)}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAction(null)}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold"
              >
                {tx.annuler}
              </button>
              <button
                disabled={saving}
                onClick={() =>
                  action.type === 'accepter'
                    ? handleAccepter(action.offre)
                    : handleRefuser(action.offre)
                }
                className={`flex-1 py-4 rounded-xl font-semibold text-white ${
                  action.type === 'accepter' ? 'bg-kourti-orange' : 'bg-red-500'
                }`}
              >
                {saving ? '...' : action.type === 'accepter' ? tx.confirmer : tx.confRefus}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contre-offre */}
      {action?.type === 'contre' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl px-6 py-8">
            <p className="font-bold text-gray-800 text-lg mb-2">↔ {tx.contreTitre}</p>
            <p className="text-gray-500 text-sm mb-5">{tx.contreMsg}</p>

            <p className="text-sm text-gray-600 mb-2">{tx.contrePrix}</p>
            <input
              type="number" inputMode="numeric"
              value={contrePrix}
              onChange={e => setContrePrix(e.target.value)}
              className="input-field text-center text-3xl font-bold mb-4"
              style={{ direction: 'ltr' }}
            />
            <p className="text-sm text-gray-600 mb-2">{tx.contreQte}</p>
            <input
              type="number" inputMode="numeric"
              value={contreQte}
              placeholder={String(action.offre.quantite)}
              onChange={e => setContreQte(e.target.value)}
              className="input-field text-center text-xl font-bold mb-6"
              style={{ direction: 'ltr' }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setAction(null)}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold"
              >
                {tx.annuler}
              </button>
              <button
                disabled={saving || !contrePrix}
                onClick={() => handleContreOffre(action.offre)}
                className="flex-1 py-4 rounded-xl font-semibold text-white bg-purple-600 disabled:opacity-40"
              >
                {saving ? '...' : `📨 ${tx.contreEnvoyer}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import { tempsRestant, messageErreur } from '../../lib/utils'
import { expirerOffres } from '../../lib/publication'

export default function MesOffresAcheteur() {
  const { profile }       = useAuth()
  const navigate          = useNavigate()
  const [offres, setOffres] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      titre:      'عروضي',
      pasOffres:  'لم تقدم أي عروض بعد',
      chargement: 'جاري التحميل...',
      sujets:     'رأس',
      da_kg:      'دج/كغ',
      cash:       'نقداً',
      differe:    'آجل',
      statuts: {
        en_attente:   { label: 'قيد الانتظار',   color: 'bg-yellow-100 text-yellow-700' },
        contre_offre: { label: '↔ اقتراح مضاد',  color: 'bg-purple-100 text-purple-700' },
        acceptee:     { label: '✓ مقبولة',        color: 'bg-green-100 text-green-700'  },
        refusee:      { label: '✗ مرفوضة',        color: 'bg-red-100 text-red-500'      },
        expiree:      { label: 'منتهية',           color: 'bg-gray-100 text-gray-400'    },
        annulee:      { label: 'ملغاة',            color: 'bg-red-100 text-red-500'      },
      },
      voirTransaction: 'متابعة الصفقة',
      wilaya: 'الولاية',
      contreRecu:    'المربي يقترح عليك',
      contreAccepter:'قبول الاقتراح',
      contreRefuser: 'رفض',
      contreModifier:'تعديل عرضي',
      creneau:       'موعد التحميل',
    },
    fr: {
      titre:      'Mes offres',
      pasOffres:  'Vous n\'avez encore soumis aucune offre',
      chargement: 'Chargement...',
      sujets:     'sujets',
      da_kg:      'DA/kg',
      cash:       'Cash',
      differe:    'Crédit',
      statuts: {
        en_attente:   { label: 'En attente',     color: 'bg-yellow-100 text-yellow-700' },
        contre_offre: { label: '↔ Contre-offre', color: 'bg-purple-100 text-purple-700' },
        acceptee:     { label: '✓ Acceptée',     color: 'bg-green-100 text-green-700'  },
        refusee:      { label: '✗ Refusée',      color: 'bg-red-100 text-red-500'      },
        expiree:      { label: 'Expirée',        color: 'bg-gray-100 text-gray-400'    },
        annulee:      { label: 'Annulée',        color: 'bg-red-100 text-red-500'      },
      },
      voirTransaction: 'Suivre la transaction',
      wilaya: 'Wilaya',
      contreRecu:    'L\'éleveur vous propose',
      contreAccepter:'Accepter la proposition',
      contreRefuser: 'Refuser',
      contreModifier:'Modifier mon offre',
      creneau:       'Passage au hangar',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    loadOffres()

    // (permission notifications gérée centralement par NotifBanner)

    // Écoute Supabase Realtime sur les offres de cet acheteur
    const channel = supabase
      .channel(`offres-acheteur-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'offres',
          filter: `acheteur_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new
          setOffres(prev => {
            const mapped = prev.map(o => o.id === updated.id ? { ...o, ...updated } : o)
            // Retire immédiatement si l'offre n'est plus "en cours"
            return mapped.filter(o => {
              if (o.statut === 'en_attente' || o.statut === 'contre_offre') return true
              if (o.statut === 'acceptee' && o.transaction?.statut_transaction !== 'cloture') return true
              return false
            })
          })
          // Notifications navigateur
          if (updated.statut === 'acceptee' || updated.statut === 'contre_offre') {
            const msg = updated.statut === 'acceptee'
              ? (lang === 'fr' ? '🎉 Votre offre a été acceptée !' : '🎉 تم قبول عرضك!')
              : (lang === 'fr'
                  ? `↔ Contre-offre de l'éleveur : ${updated.contre_prix_kg} DA/kg`
                  : `↔ اقتراح مضاد من المربي: ${updated.contre_prix_kg} دج/كغ`)
            if (Notification.permission === 'granted') {
              new Notification('KOURTI كورتي', { body: msg, icon: '/pwa-192x192.png' })
            }
            if (updated.statut === 'acceptee') loadOffres() // récupère la transaction créée
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const loadOffres = async () => {
    if (!profile) return
    setLoading(true)

    await expirerOffres()

    const { data } = await supabase
      .from('offres')
      .select(`
        *,
        annonce:annonces!annonce_id (
          id, wilaya, commune, nb_sujets_restants, poids_moyen, statut,
          eleveur:users!eleveur_id ( prenom, nom, badge )
        )
      `)
      .eq('acheteur_id', profile.id)
      .order('created_at', { ascending: false })

    // Pour chaque offre acceptée, cherche la transaction liée
    const offresAvecTx = await Promise.all((data || []).map(async (offre) => {
      if (offre.statut === 'acceptee') {
        const { data: txData } = await supabase
          .from('transactions')
          .select('id, statut_transaction')
          .eq('offre_id', offre.id)
          .single()
        return { ...offre, transaction: txData || null }
      }
      return offre
    }))

    // Ne garder que les offres "en cours" :
    // - en_attente / contre_offre (en négociation)
    // - acceptée MAIS transaction pas encore clôturée ni annulée
    // Les refusées, expirées, annulées et clôturées passent dans l'historique (ProfilAcheteur)
    const offresCourantes = offresAvecTx.filter(o => {
      if (o.statut === 'en_attente' || o.statut === 'contre_offre') return true
      if (o.statut === 'acceptee' &&
          !['cloture', 'annulee'].includes(o.transaction?.statut_transaction)) return true
      return false
    })

    setOffres(offresCourantes)
    setLoading(false)
  }

  // Accepter la contre-offre de l'éleveur → conclut l'accord et crée la transaction
  const accepterContre = async (offre) => {
    setSaving(true)
    const { data: txId, error } = await supabase.rpc('accepter_offre', { p_offre_id: offre.id })
    setSaving(false)
    if (error) { alert(messageErreur(error, lang)); return }
    if (txId) navigate(`/transaction/${txId}`)
    else loadOffres()
  }

  const refuserContre = async (offre) => {
    setSaving(true)
    await supabase.from('offres').update({ statut: 'refusee' }).eq('id', offre.id)
    setSaving(false)
    setOffres(prev => prev.filter(o => o.id !== offre.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">{tx.chargement}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-24">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold">{tx.titre}</h1>
        {offres.length > 0 && (
          <p className="text-green-200 text-sm">{offres.length} offre(s)</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {offres.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-400">{tx.pasOffres}</p>
          </div>
        ) : (
          offres.map(offre => {
            const statut = tx.statuts[offre.statut] || tx.statuts.en_attente
            const ann    = offre.annonce
            const isAcceptee = offre.statut === 'acceptee'

            return (
              <div
                key={offre.id}
                className={`card ${isAcceptee ? 'border-2 border-green-500' : ''}`}
              >
                {/* Bannière acceptée */}
                {isAcceptee && (
                  <div className="bg-green-500 text-white text-sm font-bold px-4 py-2
                                  rounded-xl mb-3 text-center animate-pulse">
                    🎉 {lang === 'fr' ? 'Votre offre a été acceptée !' : 'تم قبول عرضك!'}
                  </div>
                )}

                {/* Statut + expiration */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statut.color}`}>
                    {statut.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {['en_attente', 'contre_offre'].includes(offre.statut) && tempsRestant(offre.expires_at, lang) && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                        ⏳ {lang === 'fr' ? 'expire dans' : 'تنتهي بعد'} {tempsRestant(offre.expires_at, lang)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(offre.created_at).toLocaleDateString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ')}
                    </span>
                  </div>
                </div>

                {/* Prix + paiement */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-3xl font-bold text-kourti-green">
                    {offre.prix_kg}
                    <span className="text-base font-normal text-gray-500"> {tx.da_kg}</span>
                  </p>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                    offre.type_paiement === 'cash'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {offre.type_paiement === 'cash' ? `💵 ${tx.cash}` : `📅 ${tx.differe}`}
                    {offre.type_paiement === 'differe' && offre.date_paiement_convenue
                      ? ` — ${offre.date_paiement_convenue}` : ''}
                  </span>
                </div>

                {/* Quantité + créneau de chargement */}
                <p className="text-sm text-gray-500 mb-3">
                  {offre.quantite?.toLocaleString()} {tx.sujets}
                  {offre.date_chargement_prevue && (
                    <span className="text-amber-700">
                      {' '}· 🚛 {tx.creneau} : {new Date(offre.date_chargement_prevue).toLocaleString(
                        lang === 'fr' ? 'fr-DZ' : 'ar-DZ',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>

                {/* Infos annonce */}
                {ann && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center
                                    font-bold text-kourti-green text-sm">
                      {ann.eleveur?.prenom?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {ann.eleveur?.prenom} {ann.eleveur?.nom?.[0]}.
                      </p>
                      <p className="text-xs text-gray-400">
                        {ann.wilaya} · {ann.commune} · {ann.nb_sujets_restants?.toLocaleString()} {tx.sujets}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contre-offre reçue de l'éleveur */}
                {offre.statut === 'contre_offre' && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-xs text-purple-500 font-semibold mb-1">↔ {tx.contreRecu}</p>
                    <p className="text-2xl font-black text-purple-700">
                      {offre.contre_prix_kg} <span className="text-sm font-normal">{tx.da_kg}</span>
                      {offre.contre_quantite && (
                        <span className="text-sm font-normal text-purple-500">
                          {' '}· {offre.contre_quantite.toLocaleString()} {tx.sujets}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        disabled={saving}
                        onClick={() => refuserContre(offre)}
                        className="flex-1 py-2.5 border-2 border-gray-200 text-gray-500 rounded-xl text-sm font-semibold"
                      >
                        ✗ {tx.contreRefuser}
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => navigate(`/acheteur/lot/${offre.annonce?.id}/offre`)}
                        className="flex-1 py-2.5 border-2 border-purple-300 text-purple-600 rounded-xl text-sm font-semibold"
                      >
                        ✏️ {tx.contreModifier}
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => accepterContre(offre)}
                        className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold"
                      >
                        ✓ {tx.contreAccepter}
                      </button>
                    </div>
                  </div>
                )}

                {/* Bouton transaction si acceptée */}
                {isAcceptee && offre.transaction?.id && (
                  <button
                    onClick={() => navigate(`/transaction/${offre.transaction.id}`)}
                    className="btn-primary mt-4"
                  >
                    {tx.voirTransaction} →
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}

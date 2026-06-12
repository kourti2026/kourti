import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { formatDA, tauxPresence } from '../../lib/utils'
import BottomNav from '../../components/BottomNav'

const BADGE_CONFIG = {
  nouveau:   { label: { fr: 'Nouveau',   ar: 'جديد'     }, color: 'bg-gray-100 text-gray-600',       ring: 'ring-gray-300',   emoji: '🌱', next: { fr: '1 transaction pour passer Actif',                               ar: 'صفقة ١ للانتقال لـ نشط'            } },
  actif:     { label: { fr: 'Actif',     ar: 'نشط'      }, color: 'bg-blue-100 text-blue-700',       ring: 'ring-blue-300',   emoji: '⚡', next: { fr: '5 transactions + note > 4/5 pour Confirmé',                    ar: '٥ صفقات + تقييم >٤/٥ للوصول لـ موثوق'    } },
  confirme:  { label: { fr: 'Confirmé',  ar: 'موثوق ✓'  }, color: 'bg-green-100 text-green-700',     ring: 'ring-green-400',  emoji: '✅', next: { fr: '15 transactions + note > 4.5/5 pour Fiable',                  ar: '١٥ صفقة + تقييم >٤.٥/٥ للوصول لـ موثوق ⭐' } },
  fiable:    { label: { fr: 'Fiable',    ar: 'موثوق ⭐'  }, color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400',emoji: '⭐', next: { fr: '50 transactions + note > 4.8/5 pour Référence',                ar: '٥٠ صفقة + تقييم >٤.٨/٥ للوصول لـ مرجع'    } },
  reference: { label: { fr: 'Référence', ar: 'مرجع 👑'   }, color: 'bg-yellow-100 text-yellow-700',   ring: 'ring-yellow-400', emoji: '👑', next: null },
}

// Seuils V2 — basés sur transactions + note moyenne
const BADGE_THRESHOLDS = [
  { badge: 'nouveau',   txMin: 0,  noteMin: 0   },
  { badge: 'actif',     txMin: 1,  noteMin: 0   },
  { badge: 'confirme',  txMin: 5,  noteMin: 4.0 },
  { badge: 'fiable',    txMin: 15, noteMin: 4.5 },
  { badge: 'reference', txMin: 50, noteMin: 4.8 },
]

export default function ProfilAcheteur() {
  const { profile, logout } = useAuth()
  const navigate            = useNavigate()
  const lang = profile?.langue || 'ar'

  const [transactions, setTransactions] = useState([])
  const [recos,        setRecos]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showLogout,   setShowLogout]   = useState(false)
  const [period,       setPeriod]       = useState('all')

  const t = {
    fr: {
      titre:         'Mon profil',
      fiabilite:     'Fiabilité',
      transactions:  'transactions',
      recommandations:'recommandations',
      historiqueTitle:'Historique des transactions',
      aucuneTx:      'Aucune transaction clôturée',
      recosTitle:    'Recommandations reçues',
      aucuneReco:    'Aucune recommandation reçue',
      prochainBadge: 'Prochain badge',
      sujets:        'sujets',
      kg:            'kg',
      daKg:          'DA/kg',
      deconnexion:   'Déconnexion',
      confirmDeconn: 'Voulez-vous vous déconnecter ?',
      annuler:       'Annuler',
      confirmer:     'Confirmer',
      cloturation:   'Clôturée',
      chargement:    'Chargement...',
      montant:       'Montant',
    },
    ar: {
      titre:         'حسابي',
      fiabilite:     'موثوقية',
      transactions:  'صفقة',
      recommandations:'توصية',
      historiqueTitle:'سجل الصفقات',
      aucuneTx:      'لا توجد صفقات مغلقة',
      recosTitle:    'التوصيات المستلمة',
      aucuneReco:    'لم تتلق أي توصية',
      prochainBadge: 'الشارة القادمة',
      sujets:        'رأس',
      kg:            'كغ',
      daKg:          'دج/كغ',
      deconnexion:   'تسجيل الخروج',
      confirmDeconn: 'هل تريد تسجيل الخروج؟',
      annuler:       'إلغاء',
      confirmer:     'تأكيد',
      cloturation:   'مغلقة',
      chargement:    'جاري التحميل...',
      montant:       'المبلغ',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (profile) loadData()
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)
    const [txRes, recoRes] = await Promise.all([
      supabase
        .from('transactions')
        .select(`
          id, created_at, prix_kg_reel, montant_total_reel,
          quantite_reelle_pesee, quantite_accordee,
          offre:offres!offre_id(type_paiement),
          annonce:annonces!annonce_id(wilaya, commune)
        `)
        .eq('acheteur_id', profile.id)
        .eq('statut_transaction', 'cloture')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('recommandations')
        .select('id, created_at, eleveur:users!eleveur_id(prenom, nom, badge, nb_transactions)')
        .eq('acheteur_id', profile.id)
        .eq('active', true)
        .order('created_at', { ascending: false }),
    ])
    setTransactions(txRes.data || [])
    setRecos(recoRes.data || [])
    setLoading(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  // ── Filtre par période ───────────────────────────────────────────
  const PERIODS = [
    { key: 'today', fr: "Auj.",  ar: "اليوم" },
    { key: 'week',  fr: "7j",    ar: "أسبوع" },
    { key: 'month', fr: "Mois",  ar: "الشهر" },
    { key: 'all',   fr: "Tout",  ar: "الكل"  },
  ]

  const filteredTx = useMemo(() => {
    if (period === 'all') return transactions
    const now = new Date()
    const startOf = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week:  new Date(now - 7 * 24 * 3600 * 1000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
    }[period]
    return transactions.filter(t2 => new Date(t2.created_at) >= startOf)
  }, [transactions, period])

  const badge      = BADGE_CONFIG[profile?.badge] || BADGE_CONFIG.nouveau
  const nbTx       = profile?.nb_transactions || 0
  const nbRecos    = profile?.nb_recommandations_recues || 0
  const presence   = tauxPresence(profile)
  const notePct    = profile?.note_moyenne != null
    ? Math.min(100, Math.round((profile.note_moyenne / 5) * 100))
    : null

  // Badge progress V2 — transactions + note
  const currentIdx  = BADGE_THRESHOLDS.findIndex(b => b.badge === (profile?.badge || 'nouveau'))
  const nextLevel   = BADGE_THRESHOLDS[currentIdx + 1] || null
  const txProgress  = nextLevel
    ? Math.min(100, Math.round((nbTx / nextLevel.txMin) * 100))
    : 100
  const noteMoyenne = profile?.note_moyenne || 0
  const noteProgress = nextLevel?.noteMin > 0
    ? Math.min(100, Math.round((noteMoyenne / nextLevel.noteMin) * 100))
    : 100

  // Arc SVG fiabilité
  const arcRadius = 28
  const arcCirc   = 2 * Math.PI * arcRadius
  const arcOffset = notePct != null ? arcCirc * (1 - notePct / 100) : arcCirc

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
      <p className="text-gray-400">{tx.chargement}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-28">

      {/* ─── HERO ─── */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold">{tx.titre}</h1>
          <button
            onClick={() => navigate('/profil/modifier')}
            className="text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-full"
          >
            ✏️ {lang === 'fr' ? 'Modifier le profil' : 'تعديل الملف'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="profil"
              className={`w-16 h-16 rounded-full object-cover ring-4 ${badge.ring}`} />
          ) : (
            <div className={`w-16 h-16 rounded-full bg-white/20 ring-4 ${badge.ring}
                            flex items-center justify-center text-2xl font-bold text-white`}>
              {profile?.prenom?.[0]}{profile?.nom?.[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="text-xl font-bold">{profile?.prenom} {profile?.nom}</p>
            <p className="text-green-200 text-sm">🛒 Acheteur · {profile?.wilaya}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${badge.color}`}>
                {badge.emoji} {badge.label[lang]}
              </span>
              {presence !== null && (
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  presence >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  🚩 {presence}% {lang === 'fr' ? 'présence' : 'حضور'}
                </span>
              )}
            </div>
          </div>
        </div>
        {profile?.bio && (
          <p className="text-orange-100 text-sm mt-3 italic">« {profile.bio} »</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ─── STATS VISUELLES ─── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Fiabilité (note moyenne) */}
          <div className="card flex flex-col items-center py-4">
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r={arcRadius} fill="none" stroke="#e5e7eb" strokeWidth="6"/>
              <circle
                cx="35" cy="35" r={arcRadius} fill="none"
                stroke="#166534" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={arcCirc}
                strokeDashoffset={arcOffset}
                transform="rotate(-90 35 35)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
              <text x="35" y="40" textAnchor="middle"
                fontSize="13" fontWeight="bold" fill="#166534">
                {notePct != null ? `${notePct}%` : '—'}
              </text>
            </svg>
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.fiabilite}</p>
          </div>

          {/* Transactions */}
          <div className="card flex flex-col items-center justify-center py-4">
            <p className="text-3xl font-bold text-kourti-green">{nbTx}</p>
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.transactions}</p>
          </div>

          {/* Recommandations reçues */}
          <div className="card flex flex-col items-center justify-center py-4">
            <p className="text-3xl font-bold text-kourti-green">{nbRecos}</p>
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.recommandations}</p>
          </div>
        </div>

        {/* ─── PROGRESSION VERS PROCHAIN BADGE ─── */}
        {nextLevel && (
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              🎯 {tx.prochainBadge} : {BADGE_CONFIG[nextLevel.badge]?.emoji} {BADGE_CONFIG[nextLevel.badge]?.label[lang]}
            </p>
            {/* Barre transactions */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>🔄 {tx.transactions}</span>
                <span>{nbTx} / {nextLevel.txMin}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-kourti-orange rounded-full transition-all duration-700"
                  style={{ width: `${txProgress}%` }}
                />
              </div>
            </div>
            {/* Barre note moyenne */}
            {nextLevel.noteMin > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>⭐ {lang === 'fr' ? 'Note' : 'التقييم'}</span>
                  <span>{noteMoyenne.toFixed(1)} / {nextLevel.noteMin}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${noteProgress}%` }}
                  />
                </div>
              </div>
            )}
            {badge.next && (
              <p className="text-xs text-gray-400 mt-2 italic">{badge.next[lang]}</p>
            )}
          </div>
        )}

        {/* ─── HISTORIQUE TRANSACTIONS ─── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
              📊 {tx.historiqueTitle} {filteredTx.length > 0 && `(${filteredTx.length})`}
            </p>
          </div>

          {/* Chips filtre période */}
          <div className="flex gap-2 mb-2">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`flex-1 text-xs py-1.5 rounded-full font-semibold transition-colors ${
                  period === p.key
                    ? 'bg-kourti-orange text-white'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {p[lang]}
              </button>
            ))}
          </div>

          {transactions.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm">{tx.aucuneTx}</p>
            </div>
          ) : filteredTx.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {lang === 'fr' ? 'Aucune transaction sur cette période' : 'لا صفقات في هذه الفترة'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredTx.map(t2 => (
                <button
                  key={t2.id}
                  onClick={() => navigate(`/transaction/${t2.id}`)}
                  className="bg-white rounded-xl px-3 py-2.5 w-full text-left flex items-center gap-2 active:scale-98 transition-transform"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      📍 {t2.annonce?.wilaya}{t2.annonce?.commune ? ` · ${t2.annonce.commune}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t2.prix_kg_reel ? `${t2.prix_kg_reel} ${tx.daKg}` : ''}
                      {t2.quantite_reelle_pesee ? ` · 🐔 ${t2.quantite_reelle_pesee?.toLocaleString()}` : ''}
                      {t2.offre?.type_paiement === 'cash' ? ' · 💵' : ' · 📅'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {t2.montant_total_reel && (
                      <p className="text-xs font-bold text-kourti-green">{formatDA(t2.montant_total_reel)}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(t2.created_at).toLocaleDateString(
                        lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day: '2-digit', month: 'short' }
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── RECOMMANDATIONS REÇUES ─── */}
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            ⭐ {tx.recosTitle}
          </p>
          {recos.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🌟</div>
              <p className="text-sm">{tx.aucuneReco}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recos.map(r => {
                const b = BADGE_CONFIG[r.eleveur?.badge] || BADGE_CONFIG.nouveau
                return (
                  <div key={r.id} className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center
                                    font-bold text-kourti-green text-sm flex-shrink-0">
                      {r.eleveur?.prenom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {r.eleveur?.prenom} {r.eleveur?.nom?.[0]}.
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.color}`}>
                          {b.emoji} {b.label[lang]}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(r.created_at).toLocaleDateString(
                        lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day: '2-digit', month: 'short' }
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── DÉCONNEXION ─── */}
        {!showLogout ? (
          <button
            onClick={() => setShowLogout(true)}
            className="w-full py-4 border-2 border-red-200 text-red-500 rounded-2xl font-semibold
                       active:scale-95 transition-transform"
          >
            🚪 {tx.deconnexion}
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-5 border-2 border-red-100">
            <p className="text-center font-bold text-gray-800 mb-4">{tx.confirmDeconn}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                {tx.annuler}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl text-white font-semibold bg-red-500"
              >
                {tx.confirmer}
              </button>
            </div>
          </div>
        )}

      </div>

      <BottomNav role="acheteur" />
    </div>
  )
}

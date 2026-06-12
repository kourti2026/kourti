import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'

const BADGE_CONFIG = {
  nouveau:   { label: { fr: 'Nouveau',      ar: 'جديد'     }, color: 'bg-gray-100 text-gray-600',       ring: 'ring-gray-300',   emoji: '🌱' },
  actif:     { label: { fr: 'Actif',        ar: 'نشط'      }, color: 'bg-blue-100 text-blue-700',       ring: 'ring-blue-300',   emoji: '⚡' },
  confirme:  { label: { fr: 'Confirmé',     ar: 'موثوق'    }, color: 'bg-green-100 text-green-700',     ring: 'ring-green-400',  emoji: '✅' },
  fiable:    { label: { fr: 'Fiable',       ar: 'موثوق ⭐' }, color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400',emoji: '⭐' },
  reference: { label: { fr: 'Référence',    ar: 'مرجع'     }, color: 'bg-yellow-100 text-yellow-700',   ring: 'ring-yellow-400', emoji: '👑' },
}

const STATUT_ANNONCE = {
  active:    { fr: 'Active',     ar: 'نشطة',     color: 'bg-green-50 text-green-700 ring-1 ring-green-300' },
  publiee:   { fr: 'Active',     ar: 'نشطة',     color: 'bg-green-50 text-green-700 ring-1 ring-green-300' },
  vendue:    { fr: 'Vendue',     ar: 'مُباعة',   color: 'bg-green-100 text-green-700'  },
  suspendue: { fr: 'Suspendue',  ar: 'موقوفة',   color: 'bg-orange-100 text-orange-700'},
  expiree:   { fr: 'Expirée',    ar: 'منتهية',   color: 'bg-gray-100 text-gray-500'   },
  cloturee:  { fr: 'Clôturée',   ar: 'مغلقة',    color: 'bg-blue-100 text-blue-700'   },
  _default:  { fr: 'En cours',   ar: 'جارية',    color: 'bg-gray-50 text-gray-500'    },
}

export default function ProfilEleveur() {
  const { profile, logout } = useAuth()
  const navigate            = useNavigate()
  const lang = profile?.langue || 'ar'

  const [annonces,     setAnnonces]     = useState([])
  const [recos,        setRecos]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showLogout,   setShowLogout]   = useState(false)
  const [selectedMonth,setSelectedMonth]= useState(null)

  const t = {
    fr: {
      titre:          'Mon profil',
      transactions:   'transactions',
      note:           'Fiabilité',
      annonces:       'Annonces publiées',
      aucuneAnnonce:  'Aucune annonce dans l\'historique',
      recos:          'Acheteurs recommandés',
      aucuneReco:     'Aucune recommandation donnée',
      sujets:         'sujets',
      deconnexion:    'Déconnexion',
      confirmDeconn:  'Voulez-vous vous déconnecter ?',
      annuler:        'Annuler',
      confirmer:      'Confirmer',
      wilaya:         'Wilaya',
      poidsMoyen:     'kg/sujet',
      chargement:     'Chargement...',
      modifierProfil: 'Modifier le profil',
    },
    ar: {
      titre:          'حسابي',
      transactions:   'صفقة',
      note:           'موثوقية',
      annonces:       'الإعلانات المنشورة',
      aucuneAnnonce:  'لا يوجد سجل إعلانات',
      recos:          'المشترون الموصى بهم',
      aucuneReco:     'لم تقدم أي توصية بعد',
      sujets:         'رأس',
      deconnexion:    'تسجيل الخروج',
      confirmDeconn:  'هل تريد تسجيل الخروج؟',
      annuler:        'إلغاء',
      confirmer:      'تأكيد',
      wilaya:         'الولاية',
      poidsMoyen:     'كغ/رأس',
      chargement:     'جاري التحميل...',
      modifierProfil: 'تعديل الملف الشخصي',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (profile) loadData()
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)
    const [annoncesRes, recosRes] = await Promise.all([
      supabase
        .from('annonces')
        .select('id, wilaya, commune, nb_sujets_restants, poids_moyen, statut, created_at, age_jours')
        .eq('eleveur_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('recommandations')
        .select('id, created_at, acheteur:users!acheteur_id(prenom, nom, badge, nb_transactions)')
        .eq('eleveur_id', profile.id)
        .eq('active', true)
        .order('created_at', { ascending: false }),
    ])
    setAnnonces(annoncesRes.data || [])
    setRecos(recosRes.data || [])
    setLoading(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  // ── Filtre par mois ──────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const seen = new Set()
    const out  = []
    annonces.forEach(a => {
      const key = a.created_at.slice(0, 7)
      if (!seen.has(key)) { seen.add(key); out.push(key) }
    })
    return out
  }, [annonces])

  const filteredAnnonces = useMemo(() =>
    selectedMonth ? annonces.filter(a => a.created_at.startsWith(selectedMonth)) : annonces
  , [annonces, selectedMonth])

  const monthLabel = (key) =>
    new Date(key + '-01').toLocaleDateString(
      lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { month: 'short', year: '2-digit' }
    )

  const badge   = BADGE_CONFIG[profile?.badge] || BADGE_CONFIG.nouveau
  // note_moyenne stockée sur 0-5 → convertir en pourcentage 0-100
  const notePct = profile?.note_moyenne != null
    ? Math.min(100, Math.round((profile.note_moyenne / 5) * 100))
    : null

  // Calcul visuel note (arc SVG)
  const arcRadius  = 28
  const arcCirc    = 2 * Math.PI * arcRadius
  const arcOffset  = notePct != null ? arcCirc * (1 - notePct / 100) : arcCirc

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
            ✏️ {tx.modifierProfil}
          </button>
        </div>
        <div className="flex items-center gap-4">
          {/* Avatar */}
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
            <p className="text-green-200 text-sm">🏚️ Éleveur · {profile?.wilaya}</p>
            <div className="mt-2">
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${badge.color}`}>
                {badge.emoji} {badge.label[lang]}
              </span>
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
          {/* Note / Fiabilité */}
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
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.note}</p>
          </div>

          {/* Transactions */}
          <div className="card flex flex-col items-center justify-center py-4">
            <p className="text-3xl font-bold text-kourti-green">{profile?.nb_transactions || 0}</p>
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.transactions}</p>
          </div>

          {/* Annonces publiées */}
          <div className="card flex flex-col items-center justify-center py-4">
            <p className="text-3xl font-bold text-kourti-green">{annonces.length}</p>
            <p className="text-xs text-gray-400 mt-1 text-center">{tx.annonces}</p>
          </div>
        </div>

        {/* ─── HISTORIQUE ANNONCES ─── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
              {tx.annonces} {filteredAnnonces.length > 0 && `(${filteredAnnonces.length})`}
            </p>
          </div>

          {/* Chips filtre mois */}
          {availableMonths.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedMonth(null)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  selectedMonth === null
                    ? 'bg-kourti-orange text-white'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {lang === 'fr' ? 'Tout' : 'الكل'}
              </button>
              {availableMonths.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(selectedMonth === m ? null : m)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    selectedMonth === m
                      ? 'bg-kourti-orange text-white'
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          )}

          {annonces.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">{tx.aucuneAnnonce}</p>
            </div>
          ) : filteredAnnonces.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {lang === 'fr' ? 'Aucune annonce ce mois' : 'لا إعلانات هذا الشهر'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredAnnonces.map(ann => {
                const statutCfg = STATUT_ANNONCE[ann.statut] || STATUT_ANNONCE._default
                return (
                  <div key={ann.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statutCfg.color}`}>
                      {statutCfg[lang]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {ann.wilaya}{ann.commune ? ` · ${ann.commune}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">
                        🐔 {ann.nb_sujets_restants?.toLocaleString()} {tx.sujets}
                        {ann.poids_moyen ? ` · ⚖️ ${ann.poids_moyen} ${tx.poidsMoyen}` : ''}
                        {ann.age_jours   ? ` · 📅 ${ann.age_jours}j`                   : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(ann.created_at).toLocaleDateString(
                        lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day: '2-digit', month: 'short' }
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── RECOMMANDATIONS DONNÉES ─── */}
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            👍 {tx.recos}
          </p>
          {recos.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🤝</div>
              <p className="text-sm">{tx.aucuneReco}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recos.map(r => {
                const b = BADGE_CONFIG[r.acheteur?.badge] || BADGE_CONFIG.nouveau
                return (
                  <div key={r.id} className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center
                                    font-bold text-blue-600 text-sm flex-shrink-0">
                      {r.acheteur?.prenom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {r.acheteur?.prenom} {r.acheteur?.nom?.[0]}.
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString(
                          lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day: '2-digit', month: 'short' }
                        )}
                      </p>
                    </div>
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
            className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 border-2 border-red-100 bg-white"
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

      <BottomNav role="eleveur" />
    </div>
  )
}

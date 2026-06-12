import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../config/supabase'
import { tauxPresence } from '../lib/utils'

const BADGE_CONFIG = {
  nouveau:   { label: 'Nouveau / جديد',       color: 'bg-gray-100 text-gray-600',         emoji: '🆕' },
  actif:     { label: 'Actif / نشط',           color: 'bg-blue-100 text-blue-700',         emoji: '✅' },
  confirme:  { label: 'Confirmé / موثوق',      color: 'bg-green-100 text-green-700',       emoji: '✓'  },
  fiable:    { label: 'Fiable / موثوق ⭐',     color: 'bg-emerald-100 text-emerald-700',   emoji: '⭐' },
  reference: { label: 'Référence / مرجع',      color: 'bg-yellow-100 text-yellow-700',     emoji: '👑' },
}

export default function ProfilPublic() {
  const { userId }  = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [user,        setUser]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [canCallThem, setCanCallThem] = useState(false)

  const lang = profile?.langue || 'ar'

  const t = {
    fr: {
      profil:      'Profil',
      eleveur:     'Éleveur',
      acheteur:    'Acheteur',
      transactions:'transaction(s)',
      note:        'Note de fiabilité',
      recommandes: 'recommandation(s)',
      appeler:     'Appeler',
      pasPhone:    'Numéro non disponible',
      introuvable: 'Profil introuvable',
      retour:      'Retour',
      txCommune:   'Vous avez déjà effectué une transaction ensemble.',
      pasAcces:    'Le numéro est visible uniquement après une transaction commune.',
    },
    ar: {
      profil:      'الملف الشخصي',
      eleveur:     'مربي دواجن',
      acheteur:    'مشتري',
      transactions:'صفقة',
      note:        'موثوقية الدفع',
      recommandes: 'توصية',
      appeler:     'اتصال',
      pasPhone:    'الرقم غير متاح',
      introuvable: 'الملف غير موجود',
      retour:      'رجوع',
      txCommune:   'أجريتم صفقة مشتركة من قبل.',
      pasAcces:    'يظهر الرقم فقط بعد صفقة مشتركة.',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (!userId) return
    loadProfil()
  }, [userId])

  const loadProfil = async () => {
    setLoading(true)

    // Charger le profil public (pas le phone ici — conditionnel plus bas)
    const { data: u } = await supabase
      .from('users')
      .select('id, prenom, nom, wilaya, commune, role, badge, nb_transactions, note_moyenne, nb_recommandations_recues, nb_annulations, photo_url, bio, annee_debut')
      .eq('id', userId)
      .single()

    setUser(u)

    if (u && profile?.id) {
      // Vérifier s'il existe une transaction commune clôturée entre les deux
      const { data: txCommune } = await supabase
        .from('transactions')
        .select('id')
        .or(`and(eleveur_id.eq.${profile.id},acheteur_id.eq.${userId}),and(eleveur_id.eq.${userId},acheteur_id.eq.${profile.id})`)
        .eq('statut_transaction', 'cloture')
        .limit(1)
        .single()

      if (txCommune) {
        setCanCallThem(true)
        // Re-charger avec les téléphones
        const { data: uWithPhone } = await supabase
          .from('users')
          .select('id, prenom, nom, wilaya, commune, role, badge, nb_transactions, note_moyenne, nb_recommandations_recues, nb_annulations, photo_url, bio, annee_debut, phone, phone2, phone2_whatsapp')
          .eq('id', userId)
          .single()
        setUser(uWithPhone)
      }
    }

    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
      <p className="text-gray-400">...</p>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-5xl mb-3">🚫</div>
      <p className="font-bold text-gray-600">{tx.introuvable}</p>
      <button onClick={() => navigate(-1)} className="mt-4 btn-secondary">{tx.retour}</button>
    </div>
  )

  const badge   = BADGE_CONFIG[user.badge] || BADGE_CONFIG.nouveau
  const initials = `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase()
  const fiabilite = user.note_moyenne > 0
    ? `${(user.note_moyenne / 5 * 100).toFixed(0)} %`
    : '—'
  const presence  = tauxPresence(user)
  const anciennete = user.annee_debut && user.annee_debut > 1950
    ? new Date().getFullYear() - user.annee_debut
    : null

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>

      {/* Header */}
      <div className="text-white px-4 pt-10 pb-8" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl mb-4 block">
          {lang === 'ar' ? '→' : '←'}
        </button>

        {/* Avatar + identité */}
        <div className="flex items-center gap-4">
          {user.photo_url ? (
            <img src={user.photo_url} alt="profil"
              className="w-16 h-16 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center
                            text-2xl font-extrabold text-white">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{user.prenom} {user.nom?.[0]}.</h1>
            <p className="text-orange-200 text-sm">
              {user.role === 'eleveur' ? tx.eleveur : tx.acheteur}
              {user.wilaya ? ` · ${user.wilaya}` : ''}
              {anciennete > 0 ? ` · 🏅 ${anciennete} ${lang === 'fr' ? 'ans' : 'سنة'}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-block ${badge.color}`}>
                {badge.emoji} {badge.label}
              </span>
              {presence !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-block ${
                  presence >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  🚩 {presence}% {lang === 'fr' ? 'présence' : 'حضور'}
                </span>
              )}
            </div>
          </div>
        </div>
        {user.bio && (
          <p className="text-orange-100 text-sm mt-3 italic">« {user.bio} »</p>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-4">

        {/* Stats */}
        <div className="card">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: '#E85C0D' }}>
                {user.nb_transactions || 0}
              </p>
              <p className="text-xs text-gray-400">{tx.transactions}</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#166534' }}>{fiabilite}</p>
              <p className="text-xs text-gray-400">{tx.note}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {user.nb_recommandations_recues || 0}
              </p>
              <p className="text-xs text-gray-400">{tx.recommandes}</p>
            </div>
          </div>
        </div>

        {/* Téléphone — visible uniquement si transaction commune clôturée */}
        <div className="card">
          {canCallThem ? (
            <div className="space-y-2">
              <p className="text-xs text-green-600 font-medium mb-2">✓ {tx.txCommune}</p>
              {user.phone ? (
                <a
                  href={`tel:${user.phone}`}
                  className="flex items-center justify-center gap-2 w-full py-4 text-white rounded-xl font-bold text-lg"
                  style={{ backgroundColor: '#166534' }}
                >
                  📞 {tx.appeler} — {user.phone}
                </a>
              ) : (
                <p className="text-center text-gray-400 text-sm">{tx.pasPhone}</p>
              )}
              {user.phone2 && (
                <a
                  href={user.phone2_whatsapp
                    ? `https://wa.me/${user.phone2.replace(/\D/g, '').replace(/^0/, '213')}`
                    : `tel:${user.phone2}`}
                  target={user.phone2_whatsapp ? '_blank' : undefined}
                  rel="noreferrer"
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold ${
                    user.phone2_whatsapp
                      ? 'bg-green-500 text-white'
                      : 'border-2 border-green-600 text-green-700 bg-white'
                  }`}
                >
                  {user.phone2_whatsapp ? '🟢 WhatsApp' : '📞'} — {user.phone2}
                </a>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-2xl mb-1">🔒</p>
              <p className="text-sm text-gray-400">{tx.pasAcces}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

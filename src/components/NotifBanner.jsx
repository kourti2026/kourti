import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Bannière opt-in notifications — s'affiche une seule fois aux acheteurs
 * qui n'ont pas encore accordé la permission.
 */
export default function NotifBanner() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [asking,  setAsking]  = useState(false)

  const lang = profile?.langue || 'ar'

  const t = {
    fr: {
      titre:    'Activez les notifications',
      texte:    'Soyez alerté instantanément quand un éleveur accepte votre offre.',
      activer:  'Activer',
      later:    'Plus tard',
      refused:  'Notifications bloquées par le navigateur.',
    },
    ar: {
      titre:    'فعّل الإشعارات',
      texte:    'احصل على تنبيه فوري عند قبول أي عرض تقدمه.',
      activer:  'تفعيل',
      later:    'لاحقاً',
      refused:  'الإشعارات محجوبة من المتصفح.',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    // Montre uniquement aux acheteurs dont la permission n'est pas encore décidée
    if (!profile) return
    if (profile.role !== 'acheteur') return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return

    // Ne réafficher que si pas déjà ignoré dans cette session
    const ignored = sessionStorage.getItem('notif-banner-ignored')
    if (!ignored) setVisible(true)
  }, [profile])

  if (!visible) return null

  const handleActiver = async () => {
    setAsking(true)
    const result = await Notification.requestPermission()
    setAsking(false)
    setVisible(false)
    if (result === 'denied') {
      // optionnel : afficher un toast
    }
  }

  const handleLater = () => {
    sessionStorage.setItem('notif-banner-ignored', '1')
    setVisible(false)
  }

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40
                    bg-kourti-orange text-white rounded-2xl shadow-xl px-4 py-4
                    flex items-start gap-3 animate-fade-in">
      <div className="text-2xl mt-0.5 flex-shrink-0">🔔</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{tx.titre}</p>
        <p className="text-green-200 text-xs mt-0.5">{tx.texte}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleActiver}
            disabled={asking}
            className="bg-white text-kourti-green text-xs font-bold px-4 py-2
                       rounded-xl active:scale-95 transition-transform disabled:opacity-60"
          >
            {asking ? '...' : tx.activer}
          </button>
          <button
            onClick={handleLater}
            className="text-green-300 text-xs px-3 py-2"
          >
            {tx.later}
          </button>
        </div>
      </div>
      <button
        onClick={handleLater}
        className="text-green-300 text-lg leading-none flex-shrink-0 -mt-0.5"
      >
        ×
      </button>
    </div>
  )
}

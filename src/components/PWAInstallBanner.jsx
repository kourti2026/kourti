import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Bannière "Installer l'application" — capte l'événement beforeinstallprompt
 * du navigateur et propose une invite native au bon moment.
 */
export default function PWAInstallBanner() {
  const { profile } = useAuth()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible,        setVisible]        = useState(false)

  const lang = profile?.langue || 'ar'

  const t = {
    fr: {
      titre:     'Installer KOURTI',
      texte:     'Accès rapide depuis votre écran d\'accueil, même sans connexion.',
      installer: 'Installer',
      later:     'Plus tard',
    },
    ar: {
      titre:     'تثبيت KOURTI',
      texte:     'وصول سريع من شاشة الرئيسية، حتى بدون إنترنت.',
      installer: 'تثبيت',
      later:     'لاحقاً',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    // L'événement beforeinstallprompt se déclenche si :
    //   - le site n'est pas encore installé comme PWA
    //   - le manifest est valide avec des icônes
    //   - HTTPS (ou localhost)
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)

      // Ne pas afficher si déjà refusé dans cette session
      const dismissed = sessionStorage.getItem('pwa-banner-dismissed')
      if (!dismissed) setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Masquer si l'app est déjà en standalone (installée)
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setVisible(false)
    }
  }, [])

  if (!visible || !deferredPrompt) return null

  const handleInstaller = async () => {
    setVisible(false)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'dismissed') {
      sessionStorage.setItem('pwa-banner-dismissed', '1')
    }
    setDeferredPrompt(null)
  }

  const handleLater = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setVisible(false)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50
                    bg-white border-b border-gray-100 shadow-md
                    px-4 py-3 flex items-center gap-3">
      {/* Icône app */}
      <div className="w-10 h-10 rounded-xl bg-kourti-orange flex items-center justify-center
                      text-white font-black text-sm flex-shrink-0">
        K
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 text-sm">{tx.titre}</p>
        <p className="text-gray-400 text-xs truncate">{tx.texte}</p>
      </div>
      <button
        onClick={handleInstaller}
        className="bg-kourti-orange text-white text-xs font-bold px-4 py-2
                   rounded-xl flex-shrink-0 active:scale-95 transition-transform"
      >
        {tx.installer}
      </button>
      <button
        onClick={handleLater}
        className="text-gray-400 text-xl leading-none flex-shrink-0"
      >
        ×
      </button>
    </div>
  )
}

import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { waLink } from '../lib/whatsapp'
import { SUPPORT_PHONE } from '../config/support'

// Bouton Aide flottant : un tap → WhatsApp vers le support, message pré-rempli.
// Pour ce public, parler à un humain vaut tous les tutoriels.
export default function HelpButton() {
  const location    = useLocation()
  const { profile } = useAuth()

  // Pas de numéro configuré, ou écran d'accueil/connexion → pas de bouton
  if (!SUPPORT_PHONE) return null
  if (location.pathname === '/' || location.pathname.startsWith('/auth')) return null

  const lang = profile?.langue || 'ar'
  const msg = lang === 'fr'
    ? `Salam, j'ai besoin d'aide sur KOURTI (écran : ${location.pathname}). Je suis ${profile?.prenom || ''}.`
    : `سلام، نحتاج مساعدة في كورتي (الشاشة: ${location.pathname}). أنا ${profile?.prenom || ''}.`

  return (
    <a
      href={waLink(SUPPORT_PHONE, msg)}
      target="_blank" rel="noreferrer"
      className="fixed z-40 w-12 h-12 rounded-full bg-green-500 text-white shadow-lg
                 flex items-center justify-center text-xl active:scale-95"
      style={{ bottom: '88px', insetInlineEnd: '12px' }}
      aria-label="Aide WhatsApp"
    >
      🆘
    </a>
  )
}

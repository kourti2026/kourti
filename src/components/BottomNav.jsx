import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navEleveur = [
  { path: '/eleveur',         icon: '📢', labelAr: 'إعلاني',  labelFr: 'Annonces' },
  { path: '/eleveur/elevage', icon: '🐔', labelAr: 'مزرعتي', labelFr: 'Élevage'  },
  { path: '/forum',           icon: '💬', labelAr: 'المنتدى', labelFr: 'Forum'    },
  { path: '/cours',           icon: '📊', labelAr: 'السعر',   labelFr: 'Cours'    },
  { path: '/profil',          icon: '👤', labelAr: 'حسابي',   labelFr: 'Profil'   },
]

const navAcheteur = [
  { path: '/acheteur',        icon: '🐔', labelAr: 'الإعلانات', labelFr: 'Annonces'  },
  { path: '/acheteur/offres', icon: '📋', labelAr: 'عروضي',    labelFr: 'Mes offres' },
  { path: '/forum',           icon: '💬', labelAr: 'المنتدى',  labelFr: 'Forum'      },
  { path: '/cours',           icon: '📊', labelAr: 'السعر',     labelFr: 'Cours'     },
  { path: '/profil',          icon: '👤', labelAr: 'حسابي',     labelFr: 'Profil'    },
]

// Chemins qui appartiennent à l'onglet Élevage (pour surbrillance active)
const ELEVAGE_PATHS = [
  '/eleveur/elevage', '/eleveur/hangar', '/eleveur/serie',
]

export default function BottomNav() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { profile, nbOffresAcceptees, clearOffresAcceptees } = useAuth()

  const lang  = profile?.langue || 'ar'
  const role  = profile?.role
  const items = role === 'acheteur' ? navAcheteur : navEleveur

  const isActive = (itemPath) => {
    if (itemPath === '/eleveur/elevage') {
      return ELEVAGE_PATHS.some(p => location.pathname.startsWith(p))
    }
    if (itemPath === '/eleveur') {
      // Onglet Annonces actif SEULEMENT sur /eleveur exact ou /eleveur/publier /eleveur/offres
      return location.pathname === '/eleveur' ||
        location.pathname.startsWith('/eleveur/publier') ||
        location.pathname.startsWith('/eleveur/offres')
    }
    return location.pathname === itemPath ||
      (itemPath !== '/profil' && location.pathname.startsWith(itemPath + '/'))
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50
                    flex items-center justify-around pb-safe">
      {items.map(item => {
        const active = isActive(item.path)
        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path)
              if (item.path === '/acheteur/offres') clearOffresAcceptees?.()
            }}
            className={`flex flex-col items-center py-3 px-3 flex-1 transition-colors relative
              ${active ? 'text-kourti-green' : 'text-gray-400'}`}
          >
            <span className="text-2xl">{item.icon}</span>
            {item.path === '/acheteur/offres' && nbOffresAcceptees > 0 && (
              <span className="absolute top-2 right-3 bg-red-500 text-white text-xs
                               w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {nbOffresAcceptees}
              </span>
            )}
            <span className={`text-xs mt-1 font-medium ${active ? 'text-kourti-green' : 'text-gray-400'}`}>
              {lang === 'fr' ? item.labelFr : item.labelAr}
            </span>
            {active && <div className="w-1 h-1 rounded-full bg-kourti-orange mt-1" />}
          </button>
        )
      })}
    </nav>
  )
}

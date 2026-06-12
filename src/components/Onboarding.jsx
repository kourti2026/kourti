import { useState } from 'react'

// Onboarding 3 écrans : gros picto, une phrase, rien d'autre.
// Affiché une seule fois (localStorage), par rôle.
const SLIDES = {
  eleveur: [
    { emoji: '🐣', fr: 'Élève ta série et note chaque jour : morts, sacs, gaz.', ar: 'ربّي السيري وسجّل كل يوم: النفوق، الأكياس، الغاز.' },
    { emoji: '📢', fr: 'À 35 jours, KOURTI met ta série en vente tout seul.', ar: 'في 35 يوم، كورتي يعرض السيري للبيع وحدو.' },
    { emoji: '🤝', fr: 'Les acheteurs font des offres. Tu acceptes la meilleure, c\'est tout.', ar: 'الشّرايين يقدّمو عروض. تقبل أحسن سعر وبرك.' },
  ],
  acheteur: [
    { emoji: '🐔', fr: 'Regarde les lots disponibles près de chez toi.', ar: 'شوف الدجاج المتوفر قريب منك.' },
    { emoji: '💰', fr: 'Fais ton offre et dis quand tu viens charger.', ar: 'قدّم سعرك وقول وقتاش تجي تحمّل.' },
    { emoji: '🚛', fr: 'L\'éleveur accepte → tu viens au hangar, pesée, paiement.', ar: 'المربي يقبل ← تجي للهنڨار، الوزن، الخلاص.' },
  ],
}

export default function Onboarding({ role = 'eleveur', lang = 'ar' }) {
  const cle = `kourti_onboarding_${role}`
  const [visible, setVisible] = useState(() => !localStorage.getItem(cle))
  const [etape, setEtape] = useState(0)

  if (!visible) return null
  const slides = SLIDES[role] || SLIDES.eleveur
  const slide  = slides[etape]
  const derniere = etape === slides.length - 1

  const fermer = () => {
    localStorage.setItem(cle, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: '#E85C0D' }}>
      <div className="text-8xl mb-8 success-pop" key={etape}>{slide.emoji}</div>
      <p className="text-white text-2xl font-black leading-relaxed mb-10">
        {slide[lang === 'fr' ? 'fr' : 'ar']}
      </p>

      {/* Points d'étape */}
      <div className="flex gap-2 mb-10">
        {slides.map((_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i === etape ? 'bg-white' : 'bg-white/30'}`} />
        ))}
      </div>

      <button
        onClick={() => derniere ? fermer() : setEtape(e => e + 1)}
        className="w-full py-4 bg-white text-lg font-bold rounded-2xl active:scale-95 mb-3"
        style={{ color: '#E85C0D' }}
      >
        {derniere
          ? (lang === 'fr' ? '🚀 Commencer' : '🚀 نبداو')
          : (lang === 'fr' ? 'Suivant' : 'التالي')}
      </button>
      <button onClick={fermer} className="text-orange-200 text-sm">
        {lang === 'fr' ? 'Passer' : 'تخطي'}
      </button>
    </div>
  )
}

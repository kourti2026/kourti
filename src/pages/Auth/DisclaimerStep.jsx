import { useState } from 'react'

export default function DisclaimerStep({ onAccept, lang }) {
  const [checked, setChecked] = useState(false)

  const t = {
    ar: {
      title:   'قبل المتابعة',
      text:    'كورتي هي منصة للتواصل بين البائعين والمشترين. كورتي لا تتدخل في المعاملات المالية ولا تتحمل أي مسؤولية في حالة نزاع أو احتيال بين الأطراف. الدفع يتم مباشرة بينكم.',
      check:   'قرأت وأوافق على الشروط',
      btn:     'أدخل التطبيق',
    },
    fr: {
      title:   'Avant de continuer',
      text:    'KOURTI est une plateforme de mise en relation entre vendeurs et acheteurs. KOURTI ne participe à aucune transaction financière et décline toute responsabilité en cas de litige ou d\'escroquerie entre les parties. Le paiement se fait directement entre vous.',
      check:   'J\'ai lu et j\'accepte les conditions',
      btn:     'Entrer dans l\'application',
    }
  }
  const tx = t[lang] || t.ar

  return (
    <div className="screen justify-between">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="text-2xl font-bold text-gray-800">{tx.title}</h2>
        </div>

        <div className="card border-l-4 border-amber-400 mb-8 text-right">
          <p className="text-gray-700 leading-relaxed text-base">{tx.text}</p>
        </div>

        {/* Checkbox */}
        <button
          onClick={() => setChecked(!checked)}
          className="flex items-center gap-3 p-4 rounded-2xl border-2
            border-gray-200 bg-white active:scale-95 transition-transform"
        >
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0
            ${checked ? 'bg-kourti-orange border-kourti-green' : 'border-gray-300'}`}>
            {checked && <span className="text-white text-sm font-bold">✓</span>}
          </div>
          <span className="text-gray-700 text-right">{tx.check}</span>
        </button>
      </div>

      <button
        onClick={onAccept}
        disabled={!checked}
        className="btn-primary mt-6"
      >
        {tx.btn}
      </button>
    </div>
  )
}

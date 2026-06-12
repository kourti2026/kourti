import { useState } from 'react'

export default function RoleStep({ onSelect, lang }) {
  const [selected, setSelected] = useState(null)

  const t = {
    ar: {
      title:    'من أنت؟',
      subtitle: 'اختر دورك على المنصة',
      eleveur:  'مربي دواجن',
      eleveurS: 'عندي قن — نبيع الدجاج',
      acheteur: 'مشتري',
      acheteurS:'نشري دجاج بالجملة',
      btn:      'متابعة',
    },
    fr: {
      title:    'Qui êtes-vous ?',
      subtitle: 'Choisissez votre rôle',
      eleveur:  'Éleveur',
      eleveurS: 'J\'ai un hangar — je vends',
      acheteur: 'Acheteur',
      acheteurS:'J\'achète du poulet en gros',
      btn:      'Continuer',
    }
  }
  const tx = t[lang] || t.ar

  const roles = [
    { id: 'eleveur',  icon: '🏚️', label: tx.eleveur,  sub: tx.eleveurS },
    { id: 'acheteur', icon: '🚚', label: tx.acheteur, sub: tx.acheteurS },
  ]

  return (
    <div className="screen">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">{tx.title}</h2>
        <p className="text-gray-500 mt-2">{tx.subtitle}</p>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`card flex items-center gap-4 p-5 border-2 transition-all
              ${selected === r.id
                ? 'border-kourti-green bg-green-50'
                : 'border-gray-100'}`}
          >
            <span className="text-4xl">{r.icon}</span>
            <div className="text-right flex-1">
              <p className="font-bold text-lg text-gray-800">{r.label}</p>
              <p className="text-gray-500 text-sm">{r.sub}</p>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
              ${selected === r.id ? 'border-kourti-green bg-kourti-orange' : 'border-gray-300'}`}>
              {selected === r.id && <div className="w-3 h-3 rounded-full bg-white" />}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={() => onSelect(selected)}
          disabled={!selected}
          className="btn-primary"
        >
          {tx.btn}
        </button>
      </div>
    </div>
  )
}

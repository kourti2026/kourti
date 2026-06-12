import { useState } from 'react'
import { wilayas, getCommunes } from '../../data/wilayas'

export default function ProfileStep({ onSave, lang }) {
  const [prenom,  setPrenom]  = useState('')
  const [nom,     setNom]     = useState('')
  const [wilaya,  setWilaya]  = useState('')
  const [commune, setCommune] = useState('')
  const [loading, setLoading] = useState(false)

  const t = {
    ar: {
      title:     'معلوماتك',
      prenom:    'الاسم',
      nom:       'اللقب',
      wilaya:    'الولاية',
      commune:   'البلدية',
      selectW:   'اختر الولاية',
      selectC:   'اختر البلدية',
      btn:       'متابعة',
      saving:    'جاري الحفظ...',
    },
    fr: {
      title:     'Vos informations',
      prenom:    'Prénom',
      nom:       'Nom',
      wilaya:    'Wilaya',
      commune:   'Commune',
      selectW:   'Choisir la wilaya',
      selectC:   'Choisir la commune',
      btn:       'Continuer',
      saving:    'Enregistrement...',
    }
  }
  const tx = t[lang] || t.ar

  const communes = wilaya ? getCommunes(wilaya) : []
  const isValid  = prenom && nom && wilaya && commune

  const handleWilayaChange = (val) => {
    setWilaya(val)
    setCommune('')
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)
    await onSave({ prenom, nom, wilaya, commune })
    setLoading(false)
  }

  return (
    <div className="screen">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">{tx.title}</h2>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        <input
          type="text"
          placeholder={tx.prenom}
          value={prenom}
          onChange={e => setPrenom(e.target.value)}
          className="input-field"
        />
        <input
          type="text"
          placeholder={tx.nom}
          value={nom}
          onChange={e => setNom(e.target.value)}
          className="input-field"
        />

        {/* Wilaya */}
        <select
          value={wilaya}
          onChange={e => handleWilayaChange(e.target.value)}
          className="input-field appearance-none bg-white"
        >
          <option value="">{tx.selectW}</option>
          {wilayas.map(w => (
            <option key={w.code} value={w.code}>
              {w.code} — {w.nom}
            </option>
          ))}
        </select>

        {/* Commune */}
        <select
          value={commune}
          onChange={e => setCommune(e.target.value)}
          disabled={!wilaya}
          className="input-field appearance-none bg-white disabled:opacity-50"
        >
          <option value="">{tx.selectC}</option>
          {communes.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="btn-primary"
        >
          {loading ? tx.saving : tx.btn}
        </button>
      </div>
    </div>
  )
}

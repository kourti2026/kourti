import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { previsionAliment } from '../../lib/serieUtils'

export default function SaisieJournaliere() {
  const { serieId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [bande,       setBande]      = useState(null)
  const [jours,       setJours]      = useState([])
  const [entryId,     setEntryId]    = useState(null)
  const [sacsPrevus,  setSacsPrevus] = useState(null)  // prévision théorique
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')
  const [form, setForm] = useState({ mortalite_jour: '0', sacs_aliment: '', bouteilles_gaz: '0', notes: '' })

  const lang  = profile?.langue || 'ar'
  const today = new Date().toISOString().split('T')[0]

  const t = {
    fr: {
      titre: 'Saisie du jour', enregistrer: 'Enregistrer',
      mort: 'Mortalités du jour', sacs: "Sacs d'aliment (50 kg)",
      bouteilles: 'Bouteilles de gaz', notes: 'Notes (optionnel)',
      vivants: 'vivants après saisie', prevision: 'prévision théorique',
      errMort: 'Mortalité dépasse les sujets restants',
      avantSaisie: 'Avant saisie', apresSaisie: 'Après saisie',
    },
    ar: {
      titre: 'تسجيل اليوم', enregistrer: 'حفظ',
      mort: 'نفوق اليوم', sacs: 'أكياس العلف (50 كغ)',
      bouteilles: 'قوارير الغاز', notes: 'ملاحظات (اختياري)',
      vivants: 'رأس حي بعد التسجيل', prevision: 'توقع نظري',
      errMort: 'النفوق يتجاوز عدد الأحياء',
      avantSaisie: 'قبل التسجيل', apresSaisie: 'بعد التسجيل',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('bandes').select('*').eq('id', serieId).single(),
      supabase.from('bande_jours').select('*').eq('bande_id', serieId).order('jour'),
    ]).then(([{ data: b }, { data: j }]) => {
      setBande(b); setJours(j || [])
      const existing = (j || []).find(e => e.date_jour === today)
      if (existing) {
        setEntryId(existing.id)
        setForm({
          mortalite_jour: String(existing.mortalite_jour),
          sacs_aliment:   String(existing.sacs_aliment),
          bouteilles_gaz: String(existing.bouteilles_gaz || 0),
          notes:          existing.notes || '',
        })
      } else if (b) {
        // Pré-remplissage théorique
        const ageCourant = Math.floor((new Date() - new Date(b.date_mise_en_place)) / 86400000)
        const mortCumul  = (j || []).reduce((s, e) => s + e.mortalite_jour, 0)
        const vivants    = (b.nb_sujets_depart || b.nb_sujets_initial || 0) - mortCumul
        const prev       = previsionAliment(ageCourant - 1, vivants, b.date_mise_en_place)[0]
        const sacsVal    = prev ? (Math.round(prev.sacs * 2) / 2).toFixed(1) : '0' // arrondi au 0.5
        setSacsPrevus(sacsVal)
        setForm(f => ({ ...f, sacs_aliment: sacsVal }))
      }
    })
  }, [serieId, profile])

  const age     = bande ? Math.floor((new Date() - new Date(bande.date_mise_en_place)) / 86400000) : 0
  const depart  = bande ? (bande.nb_sujets_depart || bande.nb_sujets_initial || 0) : 0
  const mortCum = jours.filter(j => j.date_jour !== today).reduce((s, j) => s + j.mortalite_jour, 0)
  const vivants = depart - mortCum
  const vivApres = vivants - Number(form.mortalite_jour || 0)

  const Counter = ({ label, field, icon, step = 1, hint }) => {
    const val = Number(form[field] || 0)
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">{icon} {label}</p>
          {hint && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 font-medium" style={{ color: '#E85C0D' }}>
              {hint} {lang === 'fr' ? tx.prevision : tx.prevision}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setForm(f => ({ ...f, [field]: String(Math.max(0, Number(f[field]) - step).toFixed(step < 1 ? 1 : 0)) }))}
            className="w-14 h-14 rounded-2xl text-3xl font-bold border-2 border-gray-200 text-gray-600 active:scale-95 flex items-center justify-center shrink-0">
            −
          </button>
          <input type="number" inputMode="decimal" value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            onFocus={e => e.target.select()}
            className="flex-1 text-center text-4xl font-black py-2 bg-transparent border-none outline-none min-w-0" />
          <button
            onClick={() => setForm(f => ({ ...f, [field]: String((Number(f[field]) + step).toFixed(step < 1 ? 1 : 0)) }))}
            className="w-14 h-14 rounded-2xl text-3xl font-bold text-white active:scale-95 flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#E85C0D' }}>
            +
          </button>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    const mort = Number(form.mortalite_jour || 0)
    if (mort > vivants) return setError(tx.errMort)
    setSaving(true); setError('')
    const payload = {
      bande_id: serieId, jour: age, date_jour: today,
      mortalite_jour: mort,
      sacs_aliment:   Number(form.sacs_aliment || 0),
      bouteilles_gaz: Number(form.bouteilles_gaz || 0),
      notes:          form.notes || null,
      updated_at:     new Date().toISOString(),
    }
    const { error: err } = entryId
      ? await supabase.from('bande_jours').update(payload).eq('id', entryId)
      : await supabase.from('bande_jours').insert(payload)
    setSaving(false)
    if (err) return setError(err.message)
    navigate(`/eleveur/serie/${serieId}`)
  }

  if (!bande) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
      <p className="text-gray-400">...</p>
    </div>
  )

  const dateLabel = new Date(today).toLocaleDateString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ', {
    weekday: 'long', day: '2-digit', month: 'long',
  })

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center justify-between" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl w-8">
          {lang === 'ar' ? '→' : '←'}
        </button>
        <div className="text-center">
          <p className="text-lg font-bold">{tx.titre}</p>
          <p className="text-orange-100 text-sm">J+{age} · {dateLabel}</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Vivants avant saisie */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center bg-green-50">
            <p className="text-xs text-gray-400 mb-1">{tx.avantSaisie}</p>
            <p className="font-black text-2xl" style={{ color: '#166534' }}>{vivants.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{lang === 'fr' ? 'vivants' : 'رأس حي'}</p>
          </div>
          <div className={`card text-center ${vivApres < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-400 mb-1">{tx.apresSaisie}</p>
            <p className={`font-black text-2xl ${vivApres < 0 ? 'text-red-500' : 'text-gray-700'}`}>
              {vivApres.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{lang === 'fr' ? 'vivants' : 'رأس حي'}</p>
          </div>
        </div>

        <Counter label={tx.mort}       field="mortalite_jour" icon="💀" />
        <Counter label={tx.sacs}       field="sacs_aliment"   icon="🌾" step={0.5}
          hint={sacsPrevus && !entryId ? sacsPrevus : null} />
        {bande.type_chauffage === 'bouteille_gpl' && (
          <Counter label={tx.bouteilles} field="bouteilles_gaz" icon="🔥" />
        )}

        {/* Notes */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-2">📝 {tx.notes}</p>
          <textarea value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none bg-gray-50"
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }} />
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}

        <button onClick={handleSave} disabled={saving || vivApres < 0} className="btn-primary">
          {saving ? '...' : `✅ ${tx.enregistrer}`}
        </button>

      </div>
    </div>
  )
}

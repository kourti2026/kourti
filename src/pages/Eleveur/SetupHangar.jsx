import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'

export default function SetupHangar() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [hangarId, setHangarId] = useState(null)
  const [form, setForm] = useState({
    nom: 'هنكار 1', capacite_max: '', surface_m2: '',
    type_sol: 'litiere', type_chauffage: 'bouteille_gpl',
    chauffage: true, ventilation: true, dimmeur: false,
  })

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Mon Hangar', sauv: 'Enregistrer', nom: 'Nom du hangar',
      cap: 'Capacité max (sujets)', surf: 'Surface (m²)', sol: 'Type de sol',
      liti: 'Litière', cail: 'Caillebotis', etage: 'Élevage en étages',
      chauf: 'Type de chauffage', gpl: 'Bouteille GPL', gazN: 'Gaz naturel',
      elec: 'Électrique', aucun: 'Aucun',
      equip: 'Équipements', chauffage: 'Chauffage', ventil: 'Ventilation', dim: 'Dimmeur',
      ok: 'Hangar enregistré !',
    },
    ar: {
      titre: 'هنكاري', sauv: 'حفظ', nom: 'اسم الهنكار',
      cap: 'الطاقة الاستيعابية (رأس)', surf: 'المساحة (م²)', sol: 'نوع الأرضية',
      liti: 'فرشة', cail: 'شبكة', etage: 'طوابق',
      chauf: 'نوع التدفئة', gpl: 'قارورة غاز', gazN: 'غاز الشبكة',
      elec: 'كهرباء', aucun: 'بدون',
      equip: 'التجهيزات', chauffage: 'تدفئة', ventil: 'تهوية', dim: 'ديمور',
      ok: 'تم حفظ الهنكار !',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    supabase.from('hangars').select('*')
      .eq('eleveur_id', profile.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHangarId(data.id)
          setForm({
            nom: data.nom, capacite_max: data.capacite_max,
            surface_m2: data.surface_m2 || '', type_sol: data.type_sol,
            type_chauffage: data.type_chauffage, chauffage: data.chauffage,
            ventilation: data.ventilation, dimmeur: data.dimmeur,
          })
        }
        setLoading(false)
      })
  }, [profile])

  const handleSave = async () => {
    if (!form.capacite_max) return setError(lang === 'fr' ? 'Capacité obligatoire' : 'السعة إلزامية')
    setSaving(true); setError('')
    const payload = { ...form, eleveur_id: profile.id, capacite_max: Number(form.capacite_max),
      surface_m2: form.surface_m2 ? Number(form.surface_m2) : null, updated_at: new Date().toISOString() }
    const { error: err } = hangarId
      ? await supabase.from('hangars').update(payload).eq('id', hangarId)
      : await supabase.from('hangars').insert(payload)
    setSaving(false)
    if (err) return setError(err.message)
    navigate('/eleveur')
  }

  const Toggle = ({ label, field }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <span className="text-gray-700">{label}</span>
      <button
        onClick={() => setForm(f => ({ ...f, [field]: !f[field] }))}
        className={`w-12 h-6 rounded-full transition-colors ${form[field] ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form[field] ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}><p className="text-gray-400">...</p></div>

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold">{tx.titre}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase">{tx.nom}</p>
          <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
            className="input-field" />
        </div>

        <div className="card space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.cap}</p>
            <input type="number" inputMode="numeric" value={form.capacite_max}
              onChange={e => setForm(f => ({ ...f, capacite_max: e.target.value }))}
              className="input-field" placeholder="ex: 10000" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.surf}</p>
            <input type="number" inputMode="decimal" value={form.surface_m2}
              onChange={e => setForm(f => ({ ...f, surface_m2: e.target.value }))}
              className="input-field" placeholder="ex: 500" />
          </div>
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase">{tx.sol}</p>
          {[['litiere', tx.liti], ['caillebotis', tx.cail], ['etage', tx.etage]].map(([v, l]) => (
            <button key={v} onClick={() => setForm(f => ({ ...f, type_sol: v }))}
              className={`w-full py-2.5 px-4 rounded-xl mb-2 text-sm font-medium text-left border-2 transition-colors ${
                form.type_sol === v ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600 bg-white'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase">{tx.chauf}</p>
          {[['bouteille_gpl', tx.gpl], ['gaz_naturel', tx.gazN], ['electrique', tx.elec], ['aucun', tx.aucun]].map(([v, l]) => (
            <button key={v} onClick={() => setForm(f => ({ ...f, type_chauffage: v }))}
              className={`w-full py-2.5 px-4 rounded-xl mb-2 text-sm font-medium text-left border-2 transition-colors ${
                form.type_chauffage === v ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600 bg-white'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase">{tx.equip}</p>
          <Toggle label={tx.chauffage} field="chauffage" />
          <Toggle label={tx.ventil}   field="ventilation" />
          <Toggle label={tx.dim}      field="dimmeur" />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? '...' : tx.sauv}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { POIDS_REF } from '../../lib/serieUtils'

const JOURS_PESEE = [7, 14, 21, 28, 35, 42]

export default function PeseeHebdo() {
  const { serieId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [bande,   setBande]   = useState(null)
  const [pesees,  setPesees]  = useState([])
  const [entryId, setEntryId] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [form, setForm] = useState({ nb_volailles_pesees: '30', poids_total_kg: '' })

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Pesée', enregistrer: 'Enregistrer la pesée',
      nbVolailles: 'Nombre de volailles pesées', poidsTot: 'Poids total (kg)',
      poidsMoy: 'Poids moyen', ref: 'Référence souche', diff: 'Écart vs référence',
      ok: 'Pesée enregistrée !', hors: 'Hors période de pesée',
      prochaine: 'Prochaine pesée',
    },
    ar: {
      titre: 'الوزن', enregistrer: 'تسجيل الوزن',
      nbVolailles: 'عدد الطيور الموزونة', poidsTot: 'الوزن الإجمالي (كغ)',
      poidsMoy: 'متوسط الوزن', ref: 'مرجع السلالة', diff: 'الفرق عن المرجع',
      ok: 'تم تسجيل الوزن !', hors: 'ليس وقت الوزن',
      prochaine: 'الوزن القادم',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('bandes').select('*').eq('id', serieId).single(),
      supabase.from('bande_pesees').select('*').eq('bande_id', serieId).order('jour'),
    ]).then(([{ data: b }, { data: p }]) => {
      setBande(b); setPesees(p || [])
      const age = Math.floor((new Date() - new Date(b?.date_mise_en_place)) / 86400000)
      const jourCible = JOURS_PESEE.find(j => Math.abs(j - age) <= 1)
      if (jourCible) {
        const existing = (p || []).find(e => e.jour === jourCible)
        if (existing) {
          setEntryId(existing.id)
          setForm({ nb_volailles_pesees: String(existing.nb_volailles_pesees),
            poids_total_kg: String(existing.poids_total_kg) })
        }
      }
    })
  }, [serieId, profile])

  const age = bande ? Math.floor((new Date() - new Date(bande.date_mise_en_place)) / 86400000) : 0
  const jourCible = JOURS_PESEE.find(j => Math.abs(j - age) <= 1)
  const nbVol = Number(form.nb_volailles_pesees || 0)
  const poidsTot = Number(form.poids_total_kg || 0)
  const poidsMoy = nbVol > 0 ? poidsTot / nbVol : 0

  const ref = bande ? (POIDS_REF[bande.souche] || POIDS_REF['Ross 308']) : {}
  const refKeys = Object.keys(ref).map(Number).sort((a,b) => a-b)
  const refJour = jourCible || age
  const j0 = [...refKeys].reverse().find(j => j <= refJour) || 0
  const j1 = refKeys.find(j => j > refJour) || refKeys[refKeys.length - 1]
  const refPoids = j0 === j1 ? ref[j0] : ref[j0] + ((refJour - j0) / (j1 - j0)) * (ref[j1] - ref[j0])
  const diffPct = refPoids > 0 && poidsMoy > 0 ? ((poidsMoy * 1000 - refPoids) / refPoids) * 100 : null

  const handleSave = async () => {
    if (!jourCible) return setError(tx.hors)
    if (!poidsTot || !nbVol) return setError(lang === 'fr' ? 'Tous les champs sont obligatoires' : 'جميع الحقول إلزامية')
    setSaving(true); setError('')
    const payload = { bande_id: serieId, jour: jourCible, nb_volailles_pesees: nbVol, poids_total_kg: poidsTot }
    const { error: err } = entryId
      ? await supabase.from('bande_pesees').update(payload).eq('id', entryId)
      : await supabase.from('bande_pesees').insert(payload)
    setSaving(false)
    if (err) return setError(err.message)
    navigate(`/eleveur/serie/${serieId}`)
  }

  if (!bande) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}><p className="text-gray-400">...</p></div>

  const prochainJour = JOURS_PESEE.find(j => j > age) || null

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <div>
          <p className="text-lg font-bold">{tx.titre} {jourCible ? `J${jourCible}` : ''}</p>
          <p className="text-green-200 text-sm">{bande.souche} · J+{age}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {!jourCible ? (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">⚖️</div>
            <p className="font-bold text-gray-700">{tx.hors}</p>
            {prochainJour && (
              <p className="text-gray-400 text-sm mt-2">
                {tx.prochaine} : J{prochainJour} ({lang === 'fr' ? 'dans' : 'بعد'} {prochainJour - age} {lang === 'fr' ? 'jours' : 'أيام'})
              </p>
            )}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {JOURS_PESEE.map(j => {
                const done = pesees.some(p => p.jour === j)
                return (
                  <span key={j} className={`px-3 py-1 rounded-full text-xs font-semibold ${done ? 'bg-green-100 text-green-700' : j === jourCible ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    J{j} {done ? '✓' : ''}
                  </span>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="card space-y-3">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">{tx.nbVolailles}</p>
                <input type="number" inputMode="numeric" value={form.nb_volailles_pesees}
                  onChange={e => setForm(f => ({ ...f, nb_volailles_pesees: e.target.value }))} onFocus={e => e.target.select()}
                  className="input-field" placeholder="ex: 30" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">{tx.poidsTot}</p>
                <input type="number" inputMode="decimal" value={form.poids_total_kg}
                  onChange={e => setForm(f => ({ ...f, poids_total_kg: e.target.value }))} onFocus={e => e.target.select()}
                  className="input-field" placeholder="ex: 37.5" />
              </div>
            </div>

            {poidsMoy > 0 && (
              <div className="card grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400">{tx.poidsMoy}</p>
                  <p className="text-2xl font-black" style={{ color: '#E85C0D' }}>{(poidsMoy * 1000).toFixed(0)} g</p>
                  <p className="text-xs text-gray-400">{poidsMoy.toFixed(3)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{tx.ref} ({bande.souche})</p>
                  <p className="text-2xl font-black text-gray-500">{refPoids.toFixed(0)} g</p>
                  {diffPct !== null && (
                    <p className={`text-xs font-semibold ${diffPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '...' : `⚖️ ${tx.enregistrer}`}
            </button>
          </>
        )}

      </div>
    </div>
  )
}

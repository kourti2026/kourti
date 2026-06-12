import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { calcSerie, formatDA, formatKg } from '../../lib/serieUtils'

export default function VentePartielle() {
  const { serieId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [bande,  setBande]  = useState(null)
  const [jours,  setJours]  = useState([])
  const [pesees, setPesees] = useState([])
  const [ventes, setVentes] = useState([])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form, setForm] = useState({
    nb_sujets: '', poids_total_kg: '', prix_da_kg: '', acheteur_nom: '', mode_paiement: 'cash',
    date_paiement: '', notes: ''
  })

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Vente partielle', enregistrer: 'Enregistrer la vente',
      nbSujets: 'Nombre de sujets vendus', poidsTot: 'Poids total vendu (kg)',
      prixKg: 'Prix (DA/kg)', acheteur: 'Acheteur (nom)', modePmt: 'Mode de paiement',
      cash: 'Cash', credit: 'Crédit', datePmt: 'Date de paiement prévue', notes: 'Notes',
      vivants: 'Sujets vivants restants', venduCA: 'CA généré', poidsMoy: 'Poids moyen / sujet',
      errNb: 'Nombre > sujets vivants', errPrix: 'Prix obligatoire',
    },
    ar: {
      titre: 'بيع جزئي', enregistrer: 'تسجيل البيع',
      nbSujets: 'عدد الطيور المباعة', poidsTot: 'الوزن الإجمالي المباع (كغ)',
      prixKg: 'السعر (دج/كغ)', acheteur: 'المشتري (الاسم)', modePmt: 'طريقة الدفع',
      cash: 'نقدي', credit: 'آجل', datePmt: 'تاريخ الدفع المتوقع', notes: 'ملاحظات',
      vivants: 'الطيور الحية المتبقية', venduCA: 'رقم الأعمال', poidsMoy: 'متوسط وزن / طير',
      errNb: 'العدد > الطيور الحية', errPrix: 'السعر إلزامي',
    },
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('bandes').select('*').eq('id', serieId).single(),
      supabase.from('bande_jours').select('*').eq('bande_id', serieId).order('jour'),
      supabase.from('bande_pesees').select('*').eq('bande_id', serieId).order('jour'),
      supabase.from('bande_ventes').select('*').eq('bande_id', serieId).order('created_at'),
    ]).then(([{ data: b }, { data: j }, { data: p }, { data: v }]) => {
      setBande(b); setJours(j || []); setPesees(p || []); setVentes(v || [])
    })
  }, [serieId, profile])

  const stats = bande ? calcSerie(bande, jours, pesees) : null
  const vivants = stats?.vivants || 0
  const nbVendu  = Number(form.nb_sujets || 0)
  const poidsTot = Number(form.poids_total_kg || 0)
  const prixKg   = Number(form.prix_da_kg || 0)
  const ca       = poidsTot * prixKg
  const poidsMoy = nbVendu > 0 ? poidsTot / nbVendu : 0

  const handleSave = async () => {
    if (!nbVendu || !poidsTot || !prixKg) return setError(tx.errPrix)
    if (nbVendu > vivants) return setError(tx.errNb)
    setSaving(true); setError('')
    const payload = {
      bande_id: serieId,
      nb_sujets: nbVendu,
      poids_total_kg: poidsTot,
      prix_da_kg: prixKg,
      acheteur_nom: form.acheteur_nom || null,
      mode_paiement: form.mode_paiement,
      date_paiement: form.mode_paiement === 'credit' && form.date_paiement ? form.date_paiement : null,
      notes: form.notes || null,
    }
    const { error: err } = await supabase.from('bande_ventes').insert(payload)
    setSaving(false)
    if (err) return setError(err.message)
    navigate(`/eleveur/serie/${serieId}`)
  }

  if (!bande) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}><p className="text-gray-400">...</p></div>

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#166534' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <div>
          <p className="text-lg font-bold">{tx.titre}</p>
          <p className="text-green-200 text-sm">{tx.vivants} : <span className="font-bold">{vivants}</span></p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.nbSujets}</p>
              <input type="number" inputMode="numeric" value={form.nb_sujets}
                onChange={e => setForm(f => ({ ...f, nb_sujets: e.target.value }))} onFocus={e => e.target.select()}
                className="input-field" placeholder="ex: 500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.poidsTot}</p>
              <input type="number" inputMode="decimal" value={form.poids_total_kg}
                onChange={e => setForm(f => ({ ...f, poids_total_kg: e.target.value }))} onFocus={e => e.target.select()}
                className="input-field" placeholder="ex: 1250" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.prixKg}</p>
            <input type="number" inputMode="numeric" value={form.prix_da_kg}
              onChange={e => setForm(f => ({ ...f, prix_da_kg: e.target.value }))} onFocus={e => e.target.select()}
              className="input-field" placeholder="ex: 340" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.acheteur}</p>
            <input type="text" value={form.acheteur_nom}
              onChange={e => setForm(f => ({ ...f, acheteur_nom: e.target.value }))} onFocus={e => e.target.select()}
              className="input-field" />
          </div>
        </div>

        <div className="card space-y-3">
          <p className="text-xs text-gray-400 font-medium">{tx.modePmt}</p>
          <div className="grid grid-cols-2 gap-2">
            {['cash', 'credit'].map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, mode_paiement: m }))}
                className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${form.mode_paiement === m ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                {m === 'cash' ? `💵 ${tx.cash}` : `📅 ${tx.credit}`}
              </button>
            ))}
          </div>
          {form.mode_paiement === 'credit' && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.datePmt}</p>
              <input type="date" value={form.date_paiement}
                onChange={e => setForm(f => ({ ...f, date_paiement: e.target.value }))} onFocus={e => e.target.select()}
                className="input-field" />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.notes}</p>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} onFocus={e => e.target.select()}
              className="input-field resize-none" rows={2} />
          </div>
        </div>

        {ca > 0 && (
          <div className="card grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400">{tx.venduCA}</p>
              <p className="font-black text-lg" style={{ color: '#166534' }}>{formatDA(ca)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{tx.poidsMoy}</p>
              <p className="font-black text-lg text-gray-700">{formatKg(poidsMoy, 2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">DA/kg</p>
              <p className="font-black text-lg text-gray-700">{prixKg.toFixed(0)}</p>
            </div>
          </div>
        )}

        {ventes.length > 0 && (
          <div className="card">
            <p className="text-xs text-gray-400 font-semibold mb-2">
              {lang === 'fr' ? 'Ventes précédentes' : 'المبيعات السابقة'}
            </p>
            <div className="space-y-2">
              {ventes.map(v => (
                <div key={v.id} className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="text-gray-600">{v.nb_sujets} {lang === 'fr' ? 'sujets' : 'طير'} · {v.prix_da_kg} DA/kg</span>
                  <span className="font-semibold text-green-700">{formatDA(v.poids_total_kg * v.prix_da_kg)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ backgroundColor: '#166534' }}>
          {saving ? '...' : `💰 ${tx.enregistrer}`}
        </button>
      </div>
    </div>
  )
}

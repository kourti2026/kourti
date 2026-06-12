import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { calcSerie, formatDA, formatKg, icColor } from '../../lib/serieUtils'

export default function ClotureSerie() {
  const { serieId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [bande,     setBande]     = useState(null)
  const [jours,     setJours]     = useState([])
  const [pesees,    setPesees]    = useState([])
  const [ventes,    setVentes]    = useState([])
  const [cours,     setCours]     = useState(null)
  const [confirm,   setConfirm]   = useState(false)
  const [clotureForm, setClotureForm] = useState({
    nb_sujets_sortie: '', poids_total_kg: '', prix_da_kg: '', acheteur_nom: '', mode_paiement: 'cash', date_paiement: ''
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Clôture de série', bilan: 'Bilan final',
      venteFinale: 'Vente finale', cloturer: 'Clôturer la série',
      mortalite: 'Mortalité totale', survie: 'Taux de survie',
      poidsMoy: 'Poids moyen final', ic: 'Indice de consommation', ipe: 'IPE',
      coutTotal: 'Coût total', ca: "Chiffre d'affaires", marge: 'Marge nette',
      prixSeuil: 'Prix de seuil', nbSujets: 'Sujets sortis', poidsTot: 'Poids total (kg)',
      prixKg: 'Prix final (DA/kg)', acheteur: 'Acheteur', modePmt: 'Paiement',
      cash: 'Cash', credit: 'Crédit', datePmt: 'Date de paiement',
      lecons: 'Leçons automatiques', confirmer: 'Confirmer la clôture ?',
      oui: 'Oui, clôturer', non: 'Annuler',
      ok: 'Série clôturée avec succès',
      warn_poids: '⚠️ Poids moyen en dessous de la référence',
      warn_ic: '⚠️ IC élevé — consommation à optimiser',
      warn_mort: '⚠️ Mortalité > 5% — revoir biosécurité',
      good_ic: '✅ Excellent IC — bonne maîtrise alimentaire',
      good_mort: '✅ Mortalité faible — bonne santé du lot',
      good_poids: '✅ Croissance conforme à la souche',
    },
    ar: {
      titre: 'إغلاق السيري', bilan: 'الحصيلة النهائية',
      venteFinale: 'البيع النهائي', cloturer: 'إغلاق السيري',
      mortalite: 'إجمالي النفوق', survie: 'نسبة البقاء',
      poidsMoy: 'متوسط الوزن النهائي', ic: 'معامل التحويل', ipe: 'مؤشر الأداء الأوروبي',
      coutTotal: 'التكلفة الإجمالية', ca: 'رقم الأعمال', marge: 'صافي الهامش',
      prixSeuil: 'سعر التعادل', nbSujets: 'الطيور الخارجة', poidsTot: 'الوزن الإجمالي (كغ)',
      prixKg: 'السعر النهائي (دج/كغ)', acheteur: 'المشتري', modePmt: 'الدفع',
      cash: 'نقدي', credit: 'آجل', datePmt: 'تاريخ الدفع',
      lecons: 'الدروس التلقائية', confirmer: 'تأكيد الإغلاق؟',
      oui: 'نعم، أغلق', non: 'إلغاء',
      ok: 'تم إغلاق السيري بنجاح',
      warn_poids: '⚠️ الوزن أدنى من المرجع',
      warn_ic: '⚠️ معامل تحويل مرتفع — راجع التغذية',
      warn_mort: '⚠️ نفوق > 5% — راجع الصحة الحيوانية',
      good_ic: '✅ معامل تحويل ممتاز',
      good_mort: '✅ نفوق منخفض — الصحة جيدة',
      good_poids: '✅ نمو جيد وفق السلالة',
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
      supabase.from('cours_marche').select('prix_da_kg').eq('statut', 'valide').order('date_cours', { ascending: false }).limit(1),
    ]).then(([{ data: b }, { data: j }, { data: p }, { data: v }, { data: c }]) => {
      setBande(b); setJours(j || []); setPesees(p || []); setVentes(v || [])
      if (c?.length) setCours(c[0].prix_da_kg)
    })
  }, [serieId, profile])

  const stats = bande ? calcSerie(bande, jours, pesees) : null

  const totalDejaVendu = ventes.reduce((s, v) => s + v.nb_sujets, 0)
  const vivants = stats ? stats.vivants - totalDejaVendu : 0

  const nbSortie  = Number(clotureForm.nb_sujets_sortie || vivants)
  const poidsTot  = Number(clotureForm.poids_total_kg || 0)
  const prixKg    = Number(clotureForm.prix_da_kg || 0)
  const caFinal   = ventes.reduce((s,v) => s + v.poids_total_kg * v.prix_da_kg, 0) + (poidsTot * prixKg)
  const marge     = stats ? caFinal - stats.coutTotal : 0
  const margePct  = stats?.coutTotal > 0 ? (marge / stats.coutTotal) * 100 : 0

  const lecons = () => {
    if (!stats) return []
    const arr = []
    if (stats.mortalite_pct > 5) arr.push({ txt: tx.warn_mort, bad: true })
    else arr.push({ txt: tx.good_mort, bad: false })
    if (stats.ic > 1.9) arr.push({ txt: tx.warn_ic, bad: true })
    else if (stats.ic > 0) arr.push({ txt: tx.good_ic, bad: false })
    if (stats.poidsMoyEstime > 0) {
      if (stats.poidsMoyEstime < 1800) arr.push({ txt: tx.warn_poids, bad: true })
      else arr.push({ txt: tx.good_poids, bad: false })
    }
    return arr
  }

  const handleCloturer = async () => {
    if (!poidsTot || !prixKg) return setError(lang === 'fr' ? 'Remplir poids et prix' : 'أدخل الوزن والسعر')
    setSaving(true); setError('')
    const { error: errVente } = await supabase.from('bande_ventes').insert({
      bande_id: serieId, nb_sujets: nbSortie, poids_total_kg: poidsTot, prix_da_kg: prixKg,
      acheteur_nom: clotureForm.acheteur_nom || null,
      mode_paiement: clotureForm.mode_paiement,
      date_paiement: clotureForm.mode_paiement === 'credit' && clotureForm.date_paiement ? clotureForm.date_paiement : null,
    })
    if (errVente) { setSaving(false); return setError(errVente.message) }
    const { error: errClose } = await supabase.from('bandes').update({
      statut: 'terminee', date_cloture: new Date().toISOString().split('T')[0]
    }).eq('id', serieId)
    setSaving(false)
    if (errClose) return setError(errClose.message)
    navigate('/eleveur')
  }

  if (!bande || !stats) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}><p className="text-gray-400">...</p></div>

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <div>
          <p className="text-lg font-bold">{tx.titre}</p>
          <p className="text-orange-100 text-sm">{bande.souche} · J+{stats.age}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* BILAN KPIs */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-3">📊 {tx.bilan}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { lbl: tx.mortalite, val: `${stats.mortaliteTot} (${stats.mortalite_pct.toFixed(1)}%)`, color: stats.mortalite_pct > 5 ? 'text-red-600' : 'text-green-700' },
              { lbl: tx.survie,    val: `${stats.survie_pct.toFixed(1)}%`,   color: 'text-green-700' },
              { lbl: tx.poidsMoy,  val: `${stats.poidsMoyEstime.toFixed(0)} g`, color: 'text-gray-700' },
              { lbl: tx.ic,        val: stats.ic > 0 ? stats.ic.toFixed(2) : '—', color: icColor(stats.ic) },
              { lbl: tx.ipe,       val: stats.ipe > 0 ? stats.ipe.toFixed(0) : '—', color: 'text-gray-700' },
              { lbl: tx.prixSeuil, val: stats.prixSeuil > 0 ? `${stats.prixSeuil.toFixed(0)} DA/kg` : '—', color: 'text-orange-600' },
              { lbl: tx.coutTotal, val: formatDA(stats.coutTotal), color: 'text-gray-700' },
            ].map((k, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">{k.lbl}</p>
                <p className={`font-black text-lg ${k.color}`}>{k.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LEÇONS */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-2">💡 {tx.lecons}</p>
          <div className="space-y-2">
            {lecons().map((l, i) => (
              <div key={i} className={`p-2 rounded-lg text-sm ${l.bad ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {l.txt}
              </div>
            ))}
          </div>
        </div>

        {/* VENTE FINALE */}
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-gray-400 mb-1">💰 {tx.venteFinale}</p>
          <p className="text-sm text-gray-500">{tx.vivants || (lang === 'fr' ? 'Sujets restants' : 'الطيور المتبقية')} : <span className="font-bold text-gray-700">{vivants}</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.poidsTot}</p>
              <input type="number" inputMode="decimal" value={clotureForm.poids_total_kg}
                onChange={e => setClotureForm(f => ({ ...f, poids_total_kg: e.target.value }))}
                className="input-field" placeholder="kg" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.prixKg}</p>
              <input type="number" inputMode="numeric" value={clotureForm.prix_da_kg}
                onChange={e => setClotureForm(f => ({ ...f, prix_da_kg: e.target.value }))}
                className="input-field" placeholder={cours ? `≈${cours}` : 'DA/kg'} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.acheteur}</p>
            <input type="text" value={clotureForm.acheteur_nom}
              onChange={e => setClotureForm(f => ({ ...f, acheteur_nom: e.target.value }))}
              className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['cash', 'credit'].map(m => (
              <button key={m} onClick={() => setClotureForm(f => ({ ...f, mode_paiement: m }))}
                className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${clotureForm.mode_paiement === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                {m === 'cash' ? `💵 ${tx.cash}` : `📅 ${tx.credit}`}
              </button>
            ))}
          </div>
          {clotureForm.mode_paiement === 'credit' && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">{tx.datePmt}</p>
              <input type="date" value={clotureForm.date_paiement}
                onChange={e => setClotureForm(f => ({ ...f, date_paiement: e.target.value }))}
                className="input-field" />
            </div>
          )}
        </div>

        {caFinal > 0 && (
          <div className="card grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">{tx.ca}</p>
              <p className="font-black text-xl text-green-700">{formatDA(caFinal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{tx.marge}</p>
              <p className={`font-black text-xl ${marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {marge >= 0 ? '+' : ''}{formatDA(marge)} ({margePct.toFixed(1)}%)
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}

        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="btn-primary" style={{ backgroundColor: '#E85C0D' }}>
            🔒 {tx.cloturer}
          </button>
        ) : (
          <div className="card border-2 border-orange-400 space-y-3">
            <p className="font-bold text-center text-gray-700">⚠️ {tx.confirmer}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="py-3 rounded-xl bg-gray-100 font-semibold text-gray-600">
                {tx.non}
              </button>
              <button onClick={handleCloturer} disabled={saving}
                className="py-3 rounded-xl text-white font-semibold" style={{ backgroundColor: '#E85C0D' }}>
                {saving ? '...' : tx.oui}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

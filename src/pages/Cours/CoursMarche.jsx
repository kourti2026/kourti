import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import { wilayas } from '../../data/wilayas'

// ─── Composant graphique SVG ──────────────────────────────────────────────────
function PriceChart({ data, lang }) {
  if (!data || data.length < 2) return null

  const W = 320, H = 140, PAD = { top: 12, right: 12, bottom: 28, left: 36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const allPrix = data.flatMap(d => [d.prix_min, d.prix_moyen, d.prix_max]).filter(Boolean)
  const pMin = Math.min(...allPrix) - 5
  const pMax = Math.max(...allPrix) + 5

  const xOf = i => PAD.left + (i / (data.length - 1)) * innerW
  const yOf = v => PAD.top  + innerH - ((v - pMin) / (pMax - pMin)) * innerH

  const polyline = (key) =>
    data.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(' ')

  const areaPath = () => {
    const top = data.map((d, i) => `${xOf(i)},${yOf(d.prix_max)}`).join(' ')
    const bot = [...data].reverse().map((d, i) => `${xOf(data.length - 1 - i)},${yOf(d.prix_min)}`).join(' ')
    return `M ${top} L ${bot} Z`
  }

  const fmt = (d) => {
    const dt = new Date(d.date)
    return dt.toLocaleDateString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day: '2-digit', month: '2-digit' })
  }

  const labelStep = Math.ceil(data.length / 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Zone min-max */}
      <path d={areaPath()} fill="#166534" opacity="0.08" />

      {/* Lignes grille horizontales */}
      {[0, 0.5, 1].map(t => {
        const y = PAD.top + innerH * (1 - t)
        const val = Math.round(pMin + t * (pMax - pMin))
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end"
              fontSize="9" fill="#9ca3af">{val}</text>
          </g>
        )
      })}

      {/* Zone colorée prix_moy */}
      <polyline points={polyline('prix_moyen')} fill="none"
        stroke="#166534" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={polyline('prix_min')} fill="none"
        stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"
        strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={polyline('prix_max')} fill="none"
        stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,2"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Points sur prix_moyen */}
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.prix_moyen)}
          r="3" fill="#166534" />
      ))}

      {/* Labels axe X */}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null
        return (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
            fontSize="8" fill="#6b7280">{fmt(d)}</text>
        )
      })}
    </svg>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CoursMarche() {
  const { profile }             = useAuth()
  const [coursAujourdhui, setCoursAujourdhui] = useState([])
  const [historique,      setHistorique]      = useState([])
  const [wilayaSel,       setWilayaSel]       = useState('')
  const [loading,         setLoading]         = useState(true)

  const lang    = profile?.langue || 'ar'
  const today   = new Date().toISOString().split('T')[0]

  const t = {
    fr: {
      titre:       'Indice KOURTI',
      sousTitre:   'Prix du marché en temps réel',
      aujourdhui:  'Aujourd\'hui',
      graphique:   'Évolution 7 jours',
      historique:  'Historique détaillé',
      toutesW:     'Toutes les wilayas',
      da_kg:       'DA/kg',
      confirme:    '✓ Confirmé (pesée)',
      estimation:  '~ Estimation',
      pasData:     'Pas encore de données pour cette wilaya',
      pasDataAuj:  'Aucune transaction enregistrée aujourd\'hui',
      pasHist:     'Pas d\'historique disponible',
      chargement:  'Chargement...',
      transactions:'transaction(s)',
      min:         'Min',
      max:         'Max',
      moy:         'Moy',
      date:        'Date',
      legendeMoy:  'Moyen',
      legendeMin:  'Min',
      legendeMax:  'Max',
    },
    ar: {
      titre:       'مؤشر KOURTI',
      sousTitre:   'أسعار السوق في الوقت الفعلي',
      aujourdhui:  'اليوم',
      graphique:   'تطور 7 أيام',
      historique:  'السجل التفصيلي',
      toutesW:     'كل الولايات',
      da_kg:       'دج/كغ',
      confirme:    '✓ مؤكد (وزن فعلي)',
      estimation:  '~ تقدير',
      pasData:     'لا توجد بيانات لهذه الولاية',
      pasDataAuj:  'لا توجد صفقات مسجلة اليوم',
      pasHist:     'لا يوجد سجل متاح',
      chargement:  'جاري التحميل...',
      transactions:'صفقة',
      min:         'أدنى',
      max:         'أقصى',
      moy:         'متوسط',
      date:        'التاريخ',
      legendeMoy:  'متوسط',
      legendeMin:  'أدنى',
      legendeMax:  'أقصى',
    }
  }
  const tx = t[lang]

  useEffect(() => { loadCours() }, [wilayaSel])

  const loadCours = async () => {
    setLoading(true)

    // Cours du jour
    let qAuj = supabase.from('prix_marche').select('*').eq('date', today).order('wilaya')
    if (wilayaSel) qAuj = qAuj.eq('wilaya', wilayaSel)
    const { data: auj } = await qAuj
    setCoursAujourdhui(auj || [])

    // Historique 7 jours (inclut aujourd'hui pour le graphique)
    const depuis7j = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    let qHist = supabase
      .from('prix_marche')
      .select('*')
      .gte('date', depuis7j)
      .order('date', { ascending: true })
      .order('wilaya')
    if (wilayaSel) qHist = qHist.eq('wilaya', wilayaSel)
    const { data: hist } = await qHist
    setHistorique(hist || [])

    setLoading(false)
  }

  const nomWilaya = (code) =>
    wilayas.find(w => w.code === code)?.nom || code

  const tendance = (prixActuel, histW) => {
    const veille = [...histW].reverse().find(h => h.date < today)
    if (!veille || !prixActuel) return null
    const diff = prixActuel - veille.prix_moyen
    if (diff > 5)  return { icon: '↑', color: 'text-green-500', label: `+${diff.toFixed(0)} DA/kg` }
    if (diff < -5) return { icon: '↓', color: 'text-red-500',   label: `${diff.toFixed(0)} DA/kg` }
    return { icon: '→', color: 'text-blue-400', label: '=' }
  }

  // Pour le graphique : regroupe par wilaya sélectionnée ou moyenne nationale
  const chartData = (() => {
    if (wilayaSel) {
      // Données wilaya sélectionnée triées par date
      return historique.filter(h => h.wilaya === wilayaSel)
    }
    // Moyenne nationale par jour
    const byDate = historique.reduce((acc, h) => {
      if (!acc[h.date]) acc[h.date] = []
      acc[h.date].push(h)
      return acc
    }, {})
    return Object.entries(byDate).map(([date, rows]) => ({
      date,
      prix_min:   Math.min(...rows.map(r => r.prix_min)),
      prix_max:   Math.max(...rows.map(r => r.prix_max)),
      prix_moyen: Math.round(rows.reduce((s, r) => s + r.prix_moyen, 0) / rows.length),
      nb_transactions: rows.reduce((s, r) => s + (r.nb_transactions || 0), 0),
    }))
  })()

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-24">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-5">
        <h1 className="text-2xl font-bold">{tx.titre}</h1>
        <p className="text-green-200 text-sm">{tx.sousTitre}</p>
      </div>

      {/* Filtre wilaya */}
      <div className="px-4 pt-4">
        <select
          value={wilayaSel}
          onChange={e => setWilayaSel(e.target.value)}
          className="input-field py-3 text-sm"
        >
          <option value="">{tx.toutesW}</option>
          {wilayas.map(w => (
            <option key={w.code} value={w.code}>{w.code} — {w.nom}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">{tx.chargement}</div>
      ) : (
        <div className="px-4 py-4 space-y-6">

          {/* ── Graphique évolution ── */}
          {chartData.length >= 2 && (
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase mb-3">
                📈 {tx.graphique}
              </p>
              <div className="card overflow-hidden">
                <div className="flex gap-4 text-xs mb-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5 bg-kourti-orange rounded" />
                    {tx.legendeMoy}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-px bg-red-400" style={{ borderTop: '2px dashed' }} />
                    {tx.legendeMin}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-px bg-blue-400" style={{ borderTop: '2px dashed' }} />
                    {tx.legendeMax}
                  </span>
                </div>
                <PriceChart data={chartData} lang={lang} />
              </div>
            </div>
          )}

          {/* ── Cours du jour ── */}
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase mb-3">
              📊 {tx.aujourdhui}
            </p>
            {coursAujourdhui.length === 0 ? (
              <div className="card text-center py-8 text-gray-400 text-sm">{tx.pasDataAuj}</div>
            ) : (
              <div className="space-y-3">
                {coursAujourdhui.map(c => {
                  const histW = historique.filter(h => h.wilaya === c.wilaya)
                  const tend  = tendance(c.prix_moyen, histW)
                  return (
                    <div key={c.id} className="card">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-800">
                          {c.wilaya} — {nomWilaya(c.wilaya)}
                        </p>
                        {tend && (
                          <span className={`text-sm font-semibold ${tend.color}`}>
                            {tend.icon} {tend.label}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-red-50 rounded-xl py-2">
                          <p className="text-xs text-gray-400">{tx.min}</p>
                          <p className="font-bold text-red-500">{c.prix_min}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl py-2">
                          <p className="text-xs text-gray-400">{tx.moy}</p>
                          <p className="font-bold" style={{ color: '#166534' }}>{c.prix_moyen}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl py-2">
                          <p className="text-xs text-gray-400">{tx.max}</p>
                          <p className="font-bold text-blue-500">{c.prix_max}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        {c.nb_transactions} {tx.transactions} · {c.type_source === 'confirme' ? tx.confirme : tx.estimation}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}

      <BottomNav role={profile?.role || 'acheteur'} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import BottomNav from '../../components/BottomNav'
import { calcSerie, calcAlertes, prochainVaccin, icColor, formatDA, formatKg, previsionAliment } from '../../lib/serieUtils'

export default function TableauDeBordSerie() {
  const { serieId }  = useParams()
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bande,   setBande]   = useState(null)
  const [jours,   setJours]   = useState([])
  const [pesees,  setPesees]  = useState([])
  const [vaccins, setVaccins] = useState([])
  const [ventes,  setVentes]  = useState([])
  const [cours,   setCours]   = useState(null)

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      age: 'Âge', vivants: 'Vivants', mortalite: 'Mortalité', poids: 'Poids moy.',
      ic: 'IC', ipe: 'IPE', gmq: 'GMQ', valeur: 'Valeur estimée',
      seuil: 'Prix de revient', cours: 'Cours du jour', marge: 'Marge estimée',
      saisir: 'Saisir aujourd\'hui', peser: 'Pesée', vendre: 'Vente', cloturer: 'Clôturer',
      vaccin: 'Prochain vaccin', fait: 'Marquer fait', joursTimeline: 'Derniers jours',
      mesure: 'mesuré ✓', estime: 'estimé ~', depart: 'Départ',
      pubAuto: 'Publication auto', publier: 'Publier maintenant',
      aucunJour: 'Aucune saisie encore — commence à J1 !',
      cloturee: 'Série clôturée', voirBilan: 'Voir le bilan',
    },
    ar: {
      age: 'العمر', vivants: 'الأحياء', mortalite: 'النفوق', poids: 'الوزن',
      ic: 'م.ت', ipe: 'م.أ.أ', gmq: 'النمو اليومي', valeur: 'القيمة التقديرية',
      seuil: 'سعر التكلفة', cours: 'سعر اليوم', marge: 'الهامش التقديري',
      saisir: 'إدخال اليوم', peser: 'وزن', vendre: 'بيع', cloturer: 'إغلاق',
      vaccin: 'اللقاح القادم', fait: 'تم التطعيم', joursTimeline: 'الأيام الأخيرة',
      mesure: 'مقاس ✓', estime: 'مقدر ~', depart: 'البداية',
      pubAuto: 'نشر تلقائي', publier: 'انشر الآن',
      aucunJour: 'لم تبدأ الإدخال بعد — ابدأ بيوم 1 !',
      cloturee: 'السيري مغلقة', voirBilan: 'عرض الحساب',
    },
  }
  const tx = t[lang]

  useEffect(() => { loadData() }, [serieId])

  const loadData = async () => {
    setLoading(true)
    const [
      { data: b },
      { data: j },
      { data: p },
      { data: v },
      { data: vt },
    ] = await Promise.all([
      supabase.from('bandes').select('*').eq('id', serieId).single(),
      supabase.from('bande_jours').select('*').eq('bande_id', serieId).order('jour'),
      supabase.from('bande_pesees').select('*').eq('bande_id', serieId).order('jour'),
      supabase.from('bande_vaccins').select('*').eq('bande_id', serieId).order('etape'),
      supabase.from('bande_ventes').select('*').eq('bande_id', serieId).order('date_vente'),
    ])
    setBande(b); setJours(j || []); setPesees(p || [])
    setVaccins(v || []); setVentes(vt || [])

    if (profile?.wilaya) {
      const today = new Date().toISOString().split('T')[0]
      const { data: c } = await supabase.from('prix_marche').select('*')
        .eq('wilaya', profile.wilaya).eq('date', today).maybeSingle()
      setCours(c)
    }
    setLoading(false)
  }

  const marquerVaccin = async (vaccin) => {
    await supabase.from('bande_vaccins').update({ fait: true, date_fait: new Date().toISOString().split('T')[0] }).eq('id', vaccin.id)
    loadData()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}><p className="text-gray-400">...</p></div>
  if (!bande)  return <div className="min-h-screen flex items-center justify-center"><p className="text-red-400">Série introuvable</p></div>

  const stats = calcSerie(bande, jours, pesees)
  const alertes = calcAlertes(stats, bande)
  const prochain = prochainVaccin(vaccins, stats.age)
  const dejaFait = jours.some(j => j.date_jour === new Date().toISOString().split('T')[0])
  const cloturee = bande.statut === 'vendue' || bande.date_cloture

  const caMonte  = ventes.reduce((s, v) => s + Number(v.montant_da), 0)
  const valeurStock = cours
    ? stats.vivants * stats.poidsMoyen_kg * ((cours.prix_min + cours.prix_max) / 2)
    : stats.vivants * stats.poidsMoyen_kg * (stats.prixSeuil || 0)
  const margeEstimee = caMonte + valeurStock - stats.coutTotal

  const alerteColors = { rouge: '#FEF2F2', orange: '#FFF7ED', vert: '#F0FDF4' }
  const alerteBorders = { rouge: '#EF4444', orange: '#E85C0D', vert: '#22C55E' }
  const alerteIcons  = { rouge: '🔴', orange: '🟡', vert: '🟢' }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#FFF7ED' }}>
      {/* Header */}
      <div className="text-white px-4 pt-10 pb-5" style={{ backgroundColor: '#E85C0D' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/eleveur')} className="text-white text-xl">←</button>
          <div className="text-center">
            <p className="text-lg font-bold">السيري — {bande.souche}</p>
            <p className="text-green-200 text-sm">{bande.date_mise_en_place}</p>
          </div>
          <div className="w-6" />
        </div>
        <div className="mt-4 text-center">
          <p className="text-5xl font-black">J+{stats.age}</p>
          <p className="text-green-200 text-sm mt-1">
            {stats.vivants.toLocaleString()} / {stats.depart.toLocaleString()} {lang === 'fr' ? 'sujets vivants' : 'رأس حي'}
          </p>
        </div>
      </div>

      {/* Mise en vente */}
      {!cloturee && bande.statut === 'publiee' && (
        <div className="mx-4 mt-4 p-3 bg-green-50 rounded-xl flex items-center justify-between" style={{ border: '1px solid #BBF7D0' }}>
          <span className="font-semibold text-green-700 text-sm">
            📢 {lang === 'fr' ? 'Série en vente' : 'السيري معروضة للبيع'}
          </span>
          <button onClick={() => navigate('/eleveur/offres')}
            className="text-sm font-bold" style={{ color: '#166534' }}>
            {lang === 'fr' ? 'Voir les offres →' : 'رؤية العروض ←'}
          </button>
        </div>
      )}
      {!cloturee && bande.statut === 'en_cours' && stats.age >= (bande.delai_publication_jours || 35) && (
        <div className="mx-4 mt-4 p-3 bg-orange-50 rounded-xl flex items-center justify-between" style={{ border: '1px solid #FED7AA' }}>
          <span className="font-semibold text-orange-700 text-sm">
            🔔 {lang === 'fr' ? 'Série prête à la vente' : 'السيري جاهزة للبيع'}
          </span>
          <button onClick={() => navigate('/eleveur/publier')}
            className="text-sm font-bold" style={{ color: '#E85C0D' }}>
            {tx.publier} →
          </button>
        </div>
      )}

      {/* Clôturée banner */}
      {cloturee && (
        <div className="mx-4 mt-4 p-3 bg-gray-100 rounded-xl flex items-center justify-between">
          <span className="font-semibold text-gray-600">🔒 {tx.cloturee}</span>
          <button onClick={() => navigate(`/eleveur/serie/${serieId}/cloture`)}
            className="text-sm font-bold" style={{ color: '#E85C0D' }}>{tx.voirBilan}</button>
        </div>
      )}

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          {alertes.map((a, i) => (
            <div key={i} className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: alerteColors[a.type], borderLeft: `4px solid ${alerteBorders[a.type]}` }}>
              {alerteIcons[a.type]} {a[lang === 'fr' ? 'fr' : 'ar']}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 mt-4 space-y-4">

        {/* KPIs grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: tx.mortalite, value: `${stats.tauxMort.toFixed(1)}%`, sub: `${stats.mortCum} têtes`, color: stats.tauxMort > 5 ? '#EF4444' : stats.tauxMort > 3 ? '#E85C0D' : '#166534' },
            { label: tx.poids, value: stats.poidsMesure ? formatKg(stats.poidsMoyen_kg) : `~${formatKg(stats.poidsMoyen_kg)}`, sub: stats.poidsMesure ? tx.mesure : tx.estime, color: '#1F2937' },
            { label: tx.ic, value: stats.ic ? stats.ic.toFixed(2) : '—', sub: '', color: null, icVal: stats.ic },
            { label: tx.gmq, value: `${stats.gmq.toFixed(0)} g/j`, sub: '', color: '#1F2937' },
          ].map(({ label, value, sub, color, icVal }, i) => (
            <div key={i} className="card text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${icVal !== undefined ? icColor(icVal) : ''}`}
                style={color && icVal === undefined ? { color } : {}}>
                {value}
              </p>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Financier */}
        <div className="card" style={{ borderLeft: '4px solid #166534' }}>
          <p className="text-xs text-gray-400 font-medium uppercase mb-3">{lang === 'fr' ? 'Finances' : 'الماليات'}</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{tx.seuil}</span>
              <span className="font-bold">{stats.prixSeuil ? formatDA(stats.prixSeuil) + '/kg' : '—'}</span>
            </div>
            {cours && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{tx.cours}</span>
                <span className="font-bold" style={{ color: '#166534' }}>{cours.prix_min}–{cours.prix_max} DA/kg</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-sm text-gray-500">{tx.valeur}</span>
              <span className="font-black text-lg" style={{ color: '#E85C0D' }}>{formatDA(stats.coutTotal > 0 ? stats.vivants * stats.poidsMoyen_kg * (cours ? (cours.prix_min + cours.prix_max) / 2 : (stats.prixSeuil || 0) * 1.1) : null)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{tx.marge}</span>
              <span className={`font-bold ${margeEstimee >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {stats.coutTotal > 0 ? (margeEstimee >= 0 ? '+' : '') + formatDA(margeEstimee) : '—'}
              </span>
            </div>
            {stats.coutTotal > 0 && (
              <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2">
                <span>{lang === 'fr' ? 'Coût total' : 'التكلفة الإجمالية'}</span>
                <span>{formatDA(stats.coutTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Prochain vaccin */}
        {prochain && (
          <div className="card flex items-center justify-between" style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
            <div>
              <p className="text-xs text-blue-500 font-medium">{tx.vaccin} — J{prochain.jour_prevu}</p>
              <p className="font-bold text-gray-800 text-sm mt-0.5">{prochain.vaccin_nom}</p>
              <p className="text-xs text-gray-400">
                {prochain.jour_prevu - stats.age <= 0
                  ? (lang === 'fr' ? 'À faire maintenant !' : 'يجب التطعيم الآن!')
                  : `${lang === 'fr' ? 'Dans' : 'بعد'} ${prochain.jour_prevu - stats.age} ${lang === 'fr' ? 'jour(s)' : 'أيام'}`}
              </p>
            </div>
            {prochain.jour_prevu - stats.age <= 0 && (
              <button onClick={() => marquerVaccin(prochain)}
                className="py-1.5 px-3 rounded-xl text-xs font-semibold text-white bg-blue-500">
                {tx.fait}
              </button>
            )}
          </div>
        )}

        {/* Lien calendrier vaccinal complet */}
        <button onClick={() => navigate(`/eleveur/serie/${serieId}/vaccins`)}
          className="w-full card flex items-center justify-between py-3"
          style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
          <span className="font-semibold text-blue-700 text-sm">
            💉 {lang === 'fr' ? 'Calendrier vaccinal complet' : 'جدول التطعيم الكامل'}
          </span>
          <span className="text-blue-400">→</span>
        </button>

        {/* Prévision aliment 7 jours */}
        {bande && stats && (
          <div className="card">
            <p className="text-sm font-bold text-gray-600 mb-3">
              🌾 {lang === 'fr' ? 'Prévision aliment — 7 prochains jours' : 'توقع العلف — 7 أيام القادمة'}
            </p>
            <div className="space-y-1.5">
              {previsionAliment(stats.age, stats.vivants, bande.date_mise_en_place).map((p, i) => {
                const sacsComplets = Math.floor(p.sacs)
                const restePct     = (p.sacs - sacsComplets) * 100
                return (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-500 w-8">J{p.jour}</span>
                      <span className="text-xs text-gray-400">{p.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-xs text-gray-400">{p.kg_total} kg</span>
                      <span className="font-bold text-gray-700">
                        {sacsComplets > 0 ? `${sacsComplets} sac${sacsComplets > 1 ? 's' : ''}` : ''}
                        {restePct > 5 ? <span className="text-xs font-normal text-gray-400"> +{restePct.toFixed(0)}%</span> : null}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {lang === 'fr' ? `Sac 50 kg · ${stats.vivants.toLocaleString()} têtes` : `كيس 50 كغ · ${stats.vivants.toLocaleString()} رأس`}
            </p>
          </div>
        )}

        {/* Timeline derniers jours */}
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase mb-3">{tx.joursTimeline}</p>
          {jours.length === 0 ? (
            <div className="card text-center py-6 text-gray-400 text-sm">{tx.aucunJour}</div>
          ) : (
            <div className="space-y-2">
              {[...jours].reverse().slice(0, 7).map(j => (
                <div key={j.id} className="card flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ backgroundColor: '#E85C0D' }}>J{j.jour}</div>
                  <div className="flex-1">
                    <div className="flex gap-4 text-sm">
                      <span>💀 {j.mortalite_jour}</span>
                      <span>🌾 {j.sacs_aliment} sacs</span>
                      {j.bouteilles_gaz > 0 && <span>🔥 {j.bouteilles_gaz}</span>}
                    </div>
                    {j.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{j.notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(j.date_jour).toLocaleDateString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ', { day:'2-digit', month:'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!cloturee && (
          <div className="space-y-3">
            <button onClick={() => navigate(`/eleveur/serie/${serieId}/jour`)}
              className="btn-primary"
              style={dejaFait ? { backgroundColor: '#9CA3AF' } : {}}>
              {dejaFait
                ? `✅ ${lang === 'fr' ? "Déjà saisi aujourd'hui" : 'تم الإدخال اليوم'}`
                : `📊 ${tx.saisir}`}
            </button>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => navigate(`/eleveur/serie/${serieId}/pesee`)}
                className="btn-secondary py-3 text-sm">⚖️ {tx.peser}</button>
              <button onClick={() => navigate(`/eleveur/serie/${serieId}/vente`)}
                className="btn-secondary py-3 text-sm">💰 {tx.vendre}</button>
              <button onClick={() => navigate(`/eleveur/serie/${serieId}/cloture`)}
                className="py-3 rounded-2xl text-sm font-semibold text-red-500 border-2 border-red-200 bg-white">
                🔒 {tx.cloturer}
              </button>
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}

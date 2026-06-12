import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'

const TYPES = ['oculaire', 'eau_de_boisson', 'spray', 'injection']
const TYPES_LABELS = { oculaire: 'Oculaire / عيني', eau_de_boisson: 'Eau / ماء', spray: 'Spray / رش', injection: 'Injection / حقن' }

const emptyVaccin = () => ({ vaccin_nom: '', vaccin_type: 'eau_de_boisson', jour_prevu: '', notes: '' })

export default function CalendrierVaccinal() {
  const { serieId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [bande,   setBande]   = useState(null)
  const [vaccins, setVaccins] = useState([])
  const [editing, setEditing] = useState(null)   // id ou 'new'
  const [form,    setForm]    = useState(emptyVaccin())
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Calendrier vaccinal', modifier: 'Modifier', ajouter: 'Ajouter un vaccin',
      nom: 'Nom du vaccin / produit', type: "Voie d'administration", jour: 'Jour prévu (J+)',
      notes: 'Notes vétérinaire (optionnel)', enregistrer: 'Enregistrer', annuler: 'Annuler',
      marquerFait: 'Marquer fait ✓', fait: 'Fait le', planBase: 'Plan de base Algérie',
      aVenir: 'À venir', realise: 'Réalisé', enRetard: 'En retard',
      errNom: 'Nom et jour obligatoires',
    },
    ar: {
      titre: 'جدول التطعيم', modifier: 'تعديل', ajouter: 'إضافة تطعيم',
      nom: 'اسم اللقاح / المنتج', type: 'طريقة الإعطاء', jour: 'اليوم المخطط له (ي+)',
      notes: 'ملاحظات الطبيب البيطري (اختياري)', enregistrer: 'حفظ', annuler: 'إلغاء',
      marquerFait: 'تم ✓', fait: 'تم يوم', planBase: 'البرنامج الأساسي للجزائر',
      aVenir: 'قادم', realise: 'تم', enRetard: 'متأخر',
      errNom: 'الاسم واليوم إلزاميان',
    },
  }
  const tx = t[lang]

  const load = async () => {
    const [{ data: b }, { data: v }] = await Promise.all([
      supabase.from('bandes').select('*').eq('id', serieId).single(),
      supabase.from('bande_vaccins').select('*').eq('bande_id', serieId).order('jour_prevu'),
    ])
    setBande(b); setVaccins(v || [])
  }

  useEffect(() => { if (profile) load() }, [serieId, profile])

  const age = bande ? Math.floor((new Date() - new Date(bande.date_mise_en_place)) / 86400000) : 0

  const statusVaccin = (v) => {
    if (v.fait) return 'realise'
    if (v.jour_prevu < age) return 'enRetard'
    return 'aVenir'
  }

  const colorStatus = { realise: '#166534', enRetard: '#dc2626', aVenir: '#6b7280' }
  const bgStatus    = { realise: '#f0fdf4', enRetard: '#fef2f2', aVenir: '#f9fafb' }

  const startEdit = (v) => {
    setEditing(v.id)
    setForm({ vaccin_nom: v.vaccin_nom, vaccin_type: v.vaccin_type || 'eau_de_boisson', jour_prevu: String(v.jour_prevu), notes: v.notes || '' })
    setError('')
  }

  const startNew = () => {
    setEditing('new')
    setForm(emptyVaccin())
    setError('')
  }

  const cancelEdit = () => { setEditing(null); setError('') }

  const handleSave = async () => {
    if (!form.vaccin_nom.trim() || !form.jour_prevu) return setError(tx.errNom)
    setSaving(true); setError('')
    const payload = {
      bande_id: serieId,
      vaccin_nom: form.vaccin_nom.trim(),
      vaccin_type: form.vaccin_type,
      jour_prevu: Number(form.jour_prevu),
      notes: form.notes || null,
    }
    if (editing === 'new') {
      // Calculer prochain numéro d'étape
      const nextEtape = vaccins.length + 1
      await supabase.from('bande_vaccins').insert({ ...payload, etape: nextEtape })
    } else {
      await supabase.from('bande_vaccins').update(payload).eq('id', editing)
    }
    await load()
    setSaving(false)
    setEditing(null)
  }

  const marquerFait = async (v) => {
    await supabase.from('bande_vaccins').update({ fait: true, date_fait: new Date().toISOString().split('T')[0] }).eq('id', v.id)
    await load()
  }

  const desFaire = async (v) => {
    await supabase.from('bande_vaccins').update({ fait: false, date_fait: null }).eq('id', v.id)
    await load()
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#166534' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <div>
          <p className="text-lg font-bold">💉 {tx.titre}</p>
          <p className="text-green-200 text-sm">{bande?.souche} · J+{age}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* Légende */}
        <div className="flex gap-3 text-xs">
          {['aVenir','realise','enRetard'].map(s => (
            <span key={s} className="px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: bgStatus[s], color: colorStatus[s] }}>
              {tx[s]}
            </span>
          ))}
        </div>

        {/* Liste vaccins */}
        {vaccins.map(v => {
          const st = statusVaccin(v)
          const isEditing = editing === v.id
          return (
            <div key={v.id} className="card" style={{ borderLeft: `4px solid ${colorStatus[st]}`, backgroundColor: bgStatus[st] }}>
              {isEditing ? (
                <EditForm form={form} setForm={setForm} tx={tx} saving={saving} error={error}
                  onSave={handleSave} onCancel={cancelEdit} lang={lang} />
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: colorStatus[st] }}>
                          J{v.jour_prevu}
                        </span>
                        <p className="font-bold text-gray-800 text-sm">{v.vaccin_nom}</p>
                      </div>
                      <p className="text-xs text-gray-500">{TYPES_LABELS[v.vaccin_type] || v.vaccin_type}</p>
                      {v.notes && <p className="text-xs text-gray-400 mt-1 italic">{v.notes}</p>}
                      {v.fait && v.date_fait && (
                        <p className="text-xs font-semibold mt-1" style={{ color: '#166634' }}>
                          ✓ {tx.fait} {new Date(v.date_fait).toLocaleDateString('fr-DZ')}
                        </p>
                      )}
                    </div>
                    <button onClick={() => startEdit(v)} className="text-gray-400 text-xs ml-2 shrink-0">
                      ✏️
                    </button>
                  </div>

                  {!v.fait ? (
                    <button onClick={() => marquerFait(v)}
                      className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: '#166534' }}>
                      {tx.marquerFait}
                    </button>
                  ) : (
                    <button onClick={() => desFaire(v)}
                      className="mt-2 text-xs text-gray-400 underline">
                      {lang === 'fr' ? 'Annuler' : 'إلغاء'}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Formulaire ajout */}
        {editing === 'new' ? (
          <div className="card border-2 border-green-300">
            <p className="text-sm font-bold text-gray-700 mb-3">+ {tx.ajouter}</p>
            <EditForm form={form} setForm={setForm} tx={tx} saving={saving} error={error}
              onSave={handleSave} onCancel={cancelEdit} lang={lang} />
          </div>
        ) : (
          <button onClick={startNew}
            className="w-full py-4 rounded-xl border-2 border-dashed border-green-300 text-green-700 font-semibold text-sm">
            + {tx.ajouter}
          </button>
        )}

      </div>
    </div>
  )
}

function EditForm({ form, setForm, tx, saving, error, onSave, onCancel, lang }) {
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 font-medium mb-1">{tx.nom}</p>
        <input value={form.vaccin_nom} onChange={e => f('vaccin_nom', e.target.value)}
          className="input-field" placeholder="ex: Gumboro IBD" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">{tx.jour}</p>
          <input type="number" inputMode="numeric" value={form.jour_prevu}
            onChange={e => f('jour_prevu', e.target.value)}
            onFocus={e => e.target.select()}
            className="input-field" placeholder="ex: 14" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">{tx.type}</p>
          <select value={form.vaccin_type} onChange={e => f('vaccin_type', e.target.value)} className="input-field">
            {Object.entries(TYPES_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-1">{tx.notes}</p>
        <input value={form.notes} onChange={e => f('notes', e.target.value)} className="input-field" />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium">
          {tx.annuler}
        </button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#166534' }}>
          {saving ? '...' : tx.enregistrer}
        </button>
      </div>
    </div>
  )
}

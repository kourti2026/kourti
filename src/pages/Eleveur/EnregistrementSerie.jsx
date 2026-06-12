import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'

const SOUCHES = ['Ross 308', 'Cobb 500', 'Hubbard', 'Arbor Acres', 'Autre']
const DELAIS  = [35, 38, 40, 42]

export default function EnregistrementSerie() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form, setForm] = useState({
    date_mise_en_place: new Date().toISOString().split('T')[0],
    nb_sujets: '', souche: 'Ross 308',
    prix_poussin_da: '', fournisseur_poussin: '',
    prix_sac_aliment_da: '', type_chauffage: 'bouteille_gpl',
    prix_bouteille_gaz_da: '', charges_diverses_da: '',
    delai_publication_jours: 35, publication_auto: true,
  })

  const lang = profile?.langue || 'ar'
  const t = {
    fr: {
      titre: 'Nouvelle Série', demarrer: 'Démarrer la série',
      dateMP: 'Date de mise en place', nbSujets: 'Nombre de poussins',
      souche: 'Souche', prix_poussin: 'Prix poussin (DA/tête)',
      fournisseur: 'Couvoir / Fournisseur (optionnel)',
      prix_sac: 'Prix du sac aliment 50 kg (DA)',
      chauf: 'Type de chauffage', gpl: 'Bouteille GPL', gazN: 'Gaz naturel',
      elec: 'Électrique', aucun: 'Aucun',
      prix_bouteille: 'Prix bouteille (DA)',
      divers: 'Autres charges estimées (DA)',
      delai: 'Vente prévue', pubAuto: 'Publication automatique',
      erreur: 'Nombre de poussins, prix poussin et prix sac sont obligatoires',
    },
    ar: {
      titre: 'سيري جديدة', demarrer: 'بدء السيري',
      dateMP: 'تاريخ التأسيس', nbSujets: 'عدد الكتاكيت',
      souche: 'السلالة', prix_poussin: 'سعر الكتكوت (دج/رأس)',
      fournisseur: 'مفرخة / المورد (اختياري)',
      prix_sac: 'سعر كيس العلف 50 كغ (دج)',
      chauf: 'نوع التدفئة', gpl: 'قارورة غاز', gazN: 'غاز الشبكة',
      elec: 'كهرباء', aucun: 'بدون',
      prix_bouteille: 'سعر القارورة (دج)',
      divers: 'تكاليف أخرى تقديرية (دج)',
      delai: 'موعد البيع', pubAuto: 'نشر تلقائي',
      erreur: 'عدد الكتاكيت والأسعار إلزامية',
    },
  }
  const tx = t[lang]

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const handleSave = async () => {
    if (!form.nb_sujets || !form.prix_poussin_da || !form.prix_sac_aliment_da)
      return setError(tx.erreur)
    setSaving(true); setError('')

    const payload = {
      eleveur_id:                profile.id,
      date_mise_en_place:        form.date_mise_en_place,
      nb_sujets_initial:         Number(form.nb_sujets),   // nom réel dans bandes
      nb_sujets_depart:          Number(form.nb_sujets),
      souche:                    form.souche,
      prix_poussin_da:           Number(form.prix_poussin_da),
      fournisseur_poussin:       form.fournisseur_poussin || null,
      prix_sac_aliment_da:       Number(form.prix_sac_aliment_da),
      type_chauffage:            form.type_chauffage,
      prix_bouteille_gaz_da:     form.prix_bouteille_gaz_da ? Number(form.prix_bouteille_gaz_da) : null,
      charges_diverses_da:       form.charges_diverses_da ? Number(form.charges_diverses_da) : 0,
      delai_publication_jours:   form.delai_publication_jours,
      publication_auto_activee:  form.publication_auto,   // nom réel dans bandes
      statut:                    'en_cours',               // valeurs: en_cours/publiee/terminee/abandonnee
    }

    const { data, error: err } = await supabase.from('bandes').insert(payload).select().single()
    if (err) { setSaving(false); return setError(err.message) }

    await supabase.rpc('generer_plan_vaccinal', { p_bande_id: data.id })
    navigate(`/eleveur/serie/${data.id}`)
  }

  // Sélectionne tout le contenu à la mise au point → plus besoin de repositionner le curseur
  const onFocusSelect = e => e.target.select()

  const NumField = ({ label, field, placeholder = '', isInt = false }) => (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <input
        type="number"
        inputMode={isInt ? 'numeric' : 'decimal'}
        value={form[field]}
        placeholder={placeholder}
        onChange={e => f(field, e.target.value)}
        onFocus={onFocusSelect}
        className="input-field"
      />
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FFF7ED' }}>
      <div className="text-white px-4 pt-10 pb-5 flex items-center gap-3" style={{ backgroundColor: '#E85C0D' }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold">{tx.titre}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Date + nb sujets */}
        <div className="card space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.dateMP}</p>
            <input type="date" value={form.date_mise_en_place}
              onChange={e => f('date_mise_en_place', e.target.value)} className="input-field" />
          </div>
          <NumField label={tx.nbSujets} field="nb_sujets" placeholder="ex: 10000" isInt />
        </div>

        {/* Souche */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase">{tx.souche}</p>
          <div className="flex flex-wrap gap-2">
            {SOUCHES.map(s => (
              <button key={s} onClick={() => f('souche', s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                  form.souche === s ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Coût poussin */}
        <div className="card space-y-3">
          <NumField label={tx.prix_poussin} field="prix_poussin_da" placeholder="ex: 85" isInt />
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.fournisseur}</p>
            <input value={form.fournisseur_poussin}
              onChange={e => f('fournisseur_poussin', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Aliment */}
        <div className="card">
          <NumField label={tx.prix_sac} field="prix_sac_aliment_da" placeholder="ex: 3200" isInt />
        </div>

        {/* Chauffage */}
        <div className="card space-y-3">
          <p className="text-xs text-gray-400 font-medium uppercase">{tx.chauf}</p>
          <div className="grid grid-cols-2 gap-2">
            {[['bouteille_gpl', tx.gpl], ['gaz_naturel', tx.gazN], ['electrique', tx.elec], ['aucun', tx.aucun]].map(([v, l]) => (
              <button key={v} onClick={() => f('type_chauffage', v)}
                className={`py-2 px-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                  form.type_chauffage === v ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
          {form.type_chauffage === 'bouteille_gpl' && (
            <NumField label={tx.prix_bouteille} field="prix_bouteille_gaz_da" placeholder="ex: 580" isInt />
          )}
        </div>

        {/* Divers */}
        <div className="card">
          <NumField label={tx.divers} field="charges_diverses_da" placeholder="ex: 5000" isInt />
        </div>

        {/* Délai vente */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase">{tx.delai}</p>
          <div className="flex gap-2">
            {DELAIS.map(d => (
              <button key={d} onClick={() => f('delai_publication_jours', d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  form.delai_publication_jours === d ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600'}`}>
                J+{d}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-700">{tx.pubAuto}</span>
            <button onClick={() => f('publication_auto', !form.publication_auto)}
              className={`w-12 h-6 rounded-full transition-colors ${form.publication_auto ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.publication_auto ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          🐣 {saving ? '...' : tx.demarrer}
        </button>

      </div>
    </div>
  )
}

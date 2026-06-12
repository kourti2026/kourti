import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import { wilayas } from '../../data/wilayas'
import AdminLayout from './AdminLayout'

const today = new Date().toISOString().split('T')[0]

export default function AdminCours() {
  const [cours, setCours]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [form, setForm]             = useState({ wilaya: '', prix_min: '', prix_max: '', prix_moyen: '', nb_transactions: '', fiabilite: 'estimation', source: 'terrain' })
  const [saving, setSaving]         = useState(false)
  const [editId, setEditId]         = useState(null)
  const [msg, setMsg]               = useState('')

  useEffect(() => { loadCours() }, [])

  const loadCours = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('prix_marche')
      .select('*')
      .eq('date', today)
      .order('wilaya')
    setCours(data || [])
    setLoading(false)
  }

  const handleEdit = (c) => {
    setEditId(c.id)
    setForm({
      wilaya: c.wilaya,
      prix_min: c.prix_min,
      prix_max: c.prix_max,
      prix_moyen: c.prix_moyen,
      nb_transactions: c.nb_transactions,
      fiabilite: c.fiabilite,
      source: c.source || 'terrain',
    })
  }

  const handleSave = async () => {
    if (!form.wilaya || !form.prix_moyen) return
    setSaving(true)
    const payload = {
      wilaya: form.wilaya,
      prix_min: parseFloat(form.prix_min) || null,
      prix_max: parseFloat(form.prix_max) || null,
      prix_moyen: parseFloat(form.prix_moyen),
      nb_transactions: parseInt(form.nb_transactions) || 0,
      fiabilite: form.fiabilite,
      source: form.source,
      date: today,
    }

    if (editId) {
      await supabase.from('prix_marche').update(payload).eq('id', editId)
    } else {
      await supabase.from('prix_marche').insert(payload)
    }

    setMsg('Enregistré ✓')
    setTimeout(() => setMsg(''), 2000)
    setForm({ wilaya: '', prix_min: '', prix_max: '', prix_moyen: '', nb_transactions: '', fiabilite: 'estimation', source: 'terrain' })
    setEditId(null)
    await loadCours()
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('prix_marche').delete().eq('id', id)
    await loadCours()
  }

  const nomWilaya = (code) => wilayas.find(w => w.code === code)?.nom || code

  return (
    <AdminLayout title="Cours du marché — Aujourd'hui">
      <div className="px-4 py-4 space-y-5">

        {/* Formulaire */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="font-semibold text-gray-700 text-sm">
            {editId ? '✏️ Modifier une entrée' : '➕ Ajouter un prix'}
          </p>

          <select
            value={form.wilaya}
            onChange={e => setForm(f => ({ ...f, wilaya: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">— Wilaya —</option>
            {wilayas.map(w => (
              <option key={w.code} value={w.code}>{w.code} — {w.nom}</option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            {['prix_min', 'prix_moyen', 'prix_max'].map(k => (
              <div key={k}>
                <label className="text-xs text-gray-400 block mb-1">
                  {k === 'prix_min' ? 'Min' : k === 'prix_moyen' ? 'Moyen *' : 'Max'} (DA/kg)
                </label>
                <input
                  type="number"
                  value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nb transactions</label>
              <input
                type="number"
                value={form.nb_transactions}
                onChange={e => setForm(f => ({ ...f, nb_transactions: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fiabilité</label>
              <select
                value={form.fiabilite}
                onChange={e => setForm(f => ({ ...f, fiabilite: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="estimation">Estimation</option>
                <option value="confirme">Confirmé (pesée)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Source</label>
            <select
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="terrain">Terrain</option>
              <option value="pesee_app">Pesée app</option>
              <option value="declaration">Déclaration</option>
            </select>
          </div>

          {msg && <p className="text-green-600 text-sm font-medium">{msg}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.wilaya || !form.prix_moyen}
              className="flex-1 bg-gray-800 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Ajouter'}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setForm({ wilaya: '', prix_min: '', prix_max: '', prix_moyen: '', nb_transactions: '', fiabilite: 'estimation', source: 'terrain' }) }}
                className="px-4 bg-gray-100 text-gray-600 py-3 rounded-xl text-sm font-semibold"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* Liste du jour */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-3">Entrées du jour ({cours.length})</p>
          {loading ? (
            <div className="text-center py-10 text-gray-400">Chargement...</div>
          ) : cours.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Aucune donnée pour aujourd'hui</div>
          ) : (
            <div className="space-y-2">
              {cours.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{c.wilaya} — {nomWilaya(c.wilaya)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.prix_min}–{c.prix_max} DA/kg · Moy: <strong>{c.prix_moyen}</strong>
                      {' '}· {c.fiabilite === 'confirme' ? '✓' : '~'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-xs text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg">Modifier</button>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 bg-red-50 px-2 py-1.5 rounded-lg">Suppr.</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

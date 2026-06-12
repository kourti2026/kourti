import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from './AdminLayout'

export default function AdminAssistants() {
  const { profile: moi } = useAuth()
  const [admins, setAdmins]     = useState([])
  const [phone, setPhone]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  useEffect(() => { loadAdmins() }, [])

  const loadAdmins = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, phone, prenom, nom, admin_role, created_at')
      .in('admin_role', ['admin', 'assistant'])
      .order('admin_role')
    setAdmins(data || [])
    setLoading(false)
  }

  const promouvoir = async () => {
    if (!phone.trim()) return
    setSaving(true)
    setMsg('')
    const { data, error } = await supabase
      .from('users')
      .update({ admin_role: 'assistant' })
      .eq('phone', phone.trim())
      .select('id, prenom, nom')
      .single()

    if (error || !data) {
      setMsg('❌ Utilisateur introuvable avec ce numéro')
    } else {
      setMsg(`✓ ${data.prenom || phone} est maintenant assistant`)
      setPhone('')
      await loadAdmins()
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const revoquer = async (user) => {
    if (user.admin_role === 'admin') return // ne pas révoquer un autre admin
    if (!confirm(`Révoquer l'accès assistant de ${user.prenom || user.phone} ?`)) return
    await supabase.from('users').update({ admin_role: null }).eq('id', user.id)
    await loadAdmins()
  }

  return (
    <AdminLayout title="Gestion des assistants">
      <div className="px-4 py-4 space-y-5">

        {/* Ajouter un assistant */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="font-semibold text-gray-700 text-sm">➕ Promouvoir un assistant</p>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Numéro de téléphone (ex: +213XXXXXXXXX)"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          {msg && (
            <p className={`text-sm font-medium ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {msg}
            </p>
          )}
          <button
            onClick={promouvoir}
            disabled={saving || !phone.trim()}
            className="w-full bg-gray-800 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Traitement...' : 'Donner accès assistant'}
          </button>
        </div>

        {/* Liste admins & assistants */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-3">Équipe admin</p>
          {loading ? (
            <div className="text-center py-10 text-gray-400">Chargement...</div>
          ) : (
            <div className="space-y-2">
              {admins.map(u => (
                <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">
                        {u.prenom || '—'} {u.nom || ''}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        u.admin_role === 'admin'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {u.admin_role === 'admin' ? 'Admin principal' : 'Assistant'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{u.phone}</p>
                  </div>

                  {u.admin_role === 'assistant' && u.id !== moi?.id && (
                    <button
                      onClick={() => revoquer(u)}
                      className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-xl font-medium hover:bg-red-100"
                    >
                      Révoquer
                    </button>
                  )}
                  {u.admin_role === 'admin' && (
                    <span className="text-xs text-gray-300">🔒</span>
                  )}
                </div>
              ))}

              {admins.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">Aucun membre</div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

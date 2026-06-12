import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../config/supabase'
import BottomNav from '../components/BottomNav'

const MAX_CHARS = 500
const WILAYAS_DZ = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem','MSila','Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt',
  'El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma',
  'Aïn Témouchent','Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar',
  'Ouled Djellal','Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet',
  'El MGhair','El Meniaa',
]

export default function Forum() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const bottomRef    = useRef(null)

  const [posts,       setPosts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [contenu,     setContenu]     = useState('')
  const [filterWilaya,setFilterWilaya]= useState('')
  const [error,       setError]       = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    fr: {
      titre:      'Forum communautaire',
      placeholder:'Posez votre question ou partagez une info… (500 caractères max)\nPas de numéros de téléphone.',
      publier:    'Publier',
      envoi:      'Publication…',
      eleveur:    'Éleveur',
      acheteur:   'Acheteur',
      tousWilayas:'Toutes les wilayas',
      pasDePost:  'Aucune discussion pour le moment. Soyez le premier !',
      errVide:    'Le message ne peut pas être vide.',
      errPhone:   'Les numéros de téléphone ne sont pas autorisés.',
      errLong:    `Maximum ${MAX_CHARS} caractères.`,
      chargement: 'Chargement…',
      il_y_a:     'Il y a ',
      min:        ' min', heure: ' h', jour: ' j',
    },
    ar: {
      titre:      'منتدى المجتمع',
      placeholder:'اطرح سؤالك أو شارك معلومة… (500 حرف كحد أقصى)\nممنوع نشر أرقام الهاتف.',
      publier:    'نشر',
      envoi:      'جاري النشر…',
      eleveur:    'مربي',
      acheteur:   'مشتري',
      tousWilayas:'كل الولايات',
      pasDePost:  'لا توجد نقاشات بعد. كن أول من يكتب!',
      errVide:    'لا يمكن أن تكون الرسالة فارغة.',
      errPhone:   'أرقام الهاتف ممنوعة.',
      errLong:    `الحد الأقصى ${MAX_CHARS} حرف.`,
      chargement: 'جاري التحميل…',
      il_y_a:     'منذ ',
      min:        ' د', heure: ' س', jour: ' ي',
    }
  }
  const tx = t[lang]

  useEffect(() => { loadPosts() }, [filterWilaya])

  const loadPosts = async () => {
    setLoading(true)
    let query = supabase
      .from('forum_posts')
      .select(`
        id, contenu, created_at, wilaya_auteur,
        auteur:users!auteur_id ( prenom, nom, role )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filterWilaya) query = query.eq('wilaya_auteur', filterWilaya)

    const { data } = await query
    setPosts(data || [])
    setLoading(false)
  }

  // Filtre téléphone : rejette si le texte contient 7+ chiffres consécutifs
  const containsPhone = (text) => /\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d/.test(text)

  const handlePublier = async () => {
    const trimmed = contenu.trim()
    if (!trimmed)               { setError(tx.errVide);  return }
    if (trimmed.length > MAX_CHARS) { setError(tx.errLong);  return }
    if (containsPhone(trimmed)) { setError(tx.errPhone); return }

    setError('')
    setSubmitting(true)
    const { error: err } = await supabase.from('forum_posts').insert({
      auteur_id:     profile.id,
      contenu:       trimmed,
      wilaya_auteur: profile.wilaya || null,
    })
    setSubmitting(false)
    if (err) { setError(err.message); return }
    setContenu('')
    loadPosts()
  }

  const tempsEcoule = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 3600) return tx.il_y_a + Math.max(1, Math.floor(diff / 60)) + tx.min
    if (diff < 86400) return tx.il_y_a + Math.floor(diff / 3600) + tx.heure
    return tx.il_y_a + Math.floor(diff / 86400) + tx.jour
  }

  const initiales = (post) => {
    const p = post.auteur?.prenom?.[0] || '?'
    const n = post.auteur?.nom?.[0]    || ''
    return (p + n).toUpperCase()
  }

  const roleColor = (role) =>
    role === 'eleveur' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#FFF7ED' }}>

      {/* Header */}
      <div className="text-white px-4 pt-10 pb-4" style={{ backgroundColor: '#E85C0D' }}>
        <h1 className="text-xl font-bold">{tx.titre}</h1>
        {/* Filtre wilaya */}
        <select
          value={filterWilaya}
          onChange={e => setFilterWilaya(e.target.value)}
          className="mt-3 w-full rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/90"
        >
          <option value="">{tx.tousWilayas}</option>
          {WILAYAS_DZ.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* Zone de saisie */}
      <div className="px-4 pt-4">
        <div className="card space-y-3">
          <textarea
            rows={3}
            value={contenu}
            onChange={e => setContenu(e.target.value)}
            placeholder={tx.placeholder}
            maxLength={MAX_CHARS}
            className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-300"
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${contenu.length > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
              {contenu.length} / {MAX_CHARS}
            </span>
            <button
              onClick={handlePublier}
              disabled={submitting || !contenu.trim()}
              className="px-5 py-2 text-white text-sm font-bold rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#E85C0D' }}
            >
              {submitting ? tx.envoi : tx.publier}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      </div>

      {/* Liste des posts */}
      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">{tx.chargement}</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-gray-400">{tx.pasDePost}</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="card">
              {/* En-tête : initiales + rôle + wilaya + temps */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center
                                font-bold text-sm text-white flex-shrink-0"
                     style={{ backgroundColor: post.auteur?.role === 'eleveur' ? '#E85C0D' : '#1D4ED8' }}>
                  {initiales(post)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColor(post.auteur?.role)}`}>
                      {post.auteur?.role === 'eleveur' ? tx.eleveur : tx.acheteur}
                    </span>
                    {post.wilaya_auteur && (
                      <span className="text-xs text-gray-500 font-medium">
                        📍 {post.wilaya_auteur}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {tempsEcoule(post.created_at)}
                </span>
              </div>
              {/* Contenu */}
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                 style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
                {post.contenu}
              </p>
            </div>
          ))
        )}
      </div>

      <div ref={bottomRef} />
      <BottomNav role={profile?.role} />
    </div>
  )
}

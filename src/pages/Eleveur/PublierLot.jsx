import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'
import { getSerieEnPlace, getStatsSerie, publierSerie } from '../../lib/publication'
import { formatKg } from '../../lib/serieUtils'

// Mise en vente : l'annonce est créée UNIQUEMENT depuis la série en place.
// Les données (sujets vivants, poids estimé, âge, souche) viennent du suivi d'élevage.
export default function PublierLot() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const fileRef     = useRef()

  const [serie,    setSerie]    = useState(null)
  const [stats,    setStats]    = useState(null)
  const [note,     setNote]     = useState('')
  const [prixAuto, setPrixAuto] = useState('')
  const [photo,    setPhoto]    = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const lang = profile?.langue || 'ar'

  const t = {
    ar: {
      titre:        'عرض السيري للبيع',
      pasSerie:     'لا توجد سيري في المزرعة',
      pasSerieDesc: 'لا يمكن نشر إعلان بيع إلا انطلاقاً من سيري قيد التربية. ابدأ سيريتك أولاً.',
      demarrer:     'بدء سيري جديدة',
      recap:        'بيانات السيري (تلقائية)',
      sujets:       'رأس حي',
      poids:        'الوزن المتوسط',
      age:          'العمر (يوم)',
      souche:       'السلالة',
      estime:       'مقدر ~',
      mesure:       'مقاس ✓',
      photo:        'صورة (اختيارية)',
      ajouterPhoto: 'إضافة صورة',
      changer:      'تغيير',
      noteLbl:      'ملاحظة (اختياري)',
      notePlaceholder: 'معلومة إضافية عن الإعلان...',
      publier:      'نشر إعلان البيع',
      publication:  'جاري النشر...',
      dejaActive:   'لديك إعلان نشط بالفعل',
      voirAnnonce:  'رؤية إعلاني',
      infoEncheres: 'سيقدم المشترون عروض أسعار، وتُعرض الأسعار على الإعلان ليتنافسوا. أنت من يقبل أو يرفض.',
      prixAuto:     'قبول فوري (اختياري)',
      prixAutoInfo: 'حدد سعراً: أي عرض يبلغه (مع تحميل خلال 48 سا) يُقبل تلقائياً حتى وأنت غير متصل. اتركه فارغاً إذا أردت دراسة كل عرض.',
      da_kg:        'دج/كغ',
    },
    fr: {
      titre:        'Mettre la série en vente',
      pasSerie:     'Aucune série en place',
      pasSerieDesc: "Une annonce de vente ne peut être créée qu'à partir d'une série en cours d'élevage. Démarrez d'abord votre série.",
      demarrer:     'Démarrer une série',
      recap:        'Données de la série (automatiques)',
      sujets:       'sujets vivants',
      poids:        'Poids moyen',
      age:          'Âge (jours)',
      souche:       'Souche',
      estime:       'estimé ~',
      mesure:       'mesuré ✓',
      photo:        'Photo (optionnelle)',
      ajouterPhoto: 'Ajouter une photo',
      changer:      'Changer',
      noteLbl:      'Note libre (optionnel)',
      notePlaceholder: 'Informations supplémentaires...',
      publier:      "Publier l'annonce de vente",
      publication:  'Publication en cours...',
      dejaActive:   'Vous avez déjà une annonce active',
      voirAnnonce:  'Voir mon annonce',
      infoEncheres: "Les acheteurs soumettront leurs offres ; les prix sont affichés sur l'annonce pour faire monter les enchères. Vous restez libre d'accepter ou refuser.",
      prixAuto:     'Acceptation immédiate (optionnel)',
      prixAutoInfo: 'Fixez un prix : toute offre qui l\'atteint (avec chargement sous 48 h) est acceptée automatiquement, même hors connexion. Laissez vide pour étudier chaque offre.',
      da_kg:        'DA/kg',
    }
  }
  const tx = t[lang]

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const b = await getSerieEnPlace(profile.id)
      if (b) {
        setSerie(b)
        setStats(await getStatsSerie(b))
      }
      setLoading(false)
    }
    load()
  }, [profile])

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file) => {
    const ext      = file.name.split('.').pop()
    const filename = `${profile.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('lots-photos')
      .upload(filename, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage
      .from('lots-photos')
      .getPublicUrl(filename)
    return urlData.publicUrl
  }

  const handlePublier = async () => {
    setError('')
    setSaving(true)
    try {
      const urlPhoto = photo ? await uploadPhoto(photo) : null
      const { deja } = await publierSerie({
        profile, bande: serie, stats,
        photoUrl: urlPhoto,
        note: note || null,
        source: 'manuelle',
        prixAuto: prixAuto ? parseFloat(prixAuto) : null,
      })
      if (deja) setError(tx.dejaActive)
      else navigate('/eleveur', { state: { publiee: true } })
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Erreur lors de la publication. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kourti-orange-bg">
        <p className="text-gray-400">...</p>
      </div>
    )
  }

  // Pas de série en place → impossible de publier
  if (!serie || !stats || stats.vivants <= 0) {
    return (
      <div className="min-h-screen bg-kourti-orange-bg flex flex-col items-center justify-center px-8 text-center">
        <div className="text-6xl mb-4">🐣</div>
        <p className="text-gray-700 font-bold text-lg mb-2">{tx.pasSerie}</p>
        <p className="text-gray-400 text-sm mb-6">{tx.pasSerieDesc}</p>
        <button onClick={() => navigate('/eleveur/serie/nouvelle')} className="btn-primary">
          + {tx.demarrer}
        </button>
        <button onClick={() => navigate(-1)} className="mt-3 text-gray-400 text-sm">
          ← {lang === 'fr' ? 'Retour' : 'رجوع'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-10">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold">{tx.titre}</h1>
      </div>

      <div className="px-4 py-5 space-y-5">

        {/* Récap série — données automatiques, non modifiables */}
        <div className="card" style={{ borderLeft: '4px solid #166534' }}>
          <p className="text-xs text-gray-400 font-medium uppercase mb-3">{tx.recap}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: '#166534' }}>
                {stats.vivants.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">{tx.sujets}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">
                {formatKg(stats.poidsMoyen_kg)}
              </p>
              <p className="text-xs text-gray-500">
                {tx.poids} · {stats.poidsMesure ? tx.mesure : tx.estime}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">J+{stats.age}</p>
              <p className="text-xs text-gray-500">{tx.age}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-700 mt-1">{serie.souche || '—'}</p>
              <p className="text-xs text-gray-500">{tx.souche}</p>
            </div>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-orange-700">💡 {tx.infoEncheres}</p>
        </div>

        {/* Prix d'acceptation automatique */}
        <div className="card" style={{ borderLeft: '4px solid #EAB308' }}>
          <p className="font-semibold text-gray-700 mb-1">⚡ {tx.prixAuto}</p>
          <p className="text-xs text-gray-400 mb-3">{tx.prixAutoInfo}</p>
          <div className="relative">
            <input
              type="number" inputMode="numeric" placeholder="ex: 300"
              value={prixAuto}
              onChange={e => setPrixAuto(e.target.value)}
              className="input-field text-center text-2xl font-bold pr-16"
              style={{ direction: 'ltr' }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
              {tx.da_kg}
            </span>
          </div>
        </div>

        {/* Photo */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">{tx.photo}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="lot" className="w-full h-48 object-cover rounded-xl" />
              <button
                onClick={() => fileRef.current.click()}
                className="absolute bottom-2 right-2 bg-white text-kourti-green
                           text-sm font-medium px-3 py-1 rounded-full shadow"
              >
                {tx.changer}
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current.click()}
              className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl
                         flex flex-col items-center justify-center gap-2 text-gray-400"
            >
              <span className="text-4xl">📷</span>
              <span className="text-sm">{tx.ajouterPhoto}</span>
            </button>
          )}
        </div>

        {/* Note libre */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-3">{tx.noteLbl}</p>
          <textarea
            placeholder={tx.notePlaceholder}
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 100))}
            rows={3}
            className="input-field resize-none"
          />
          <p className="text-xs text-gray-400 text-left mt-1">{note.length}/100</p>
        </div>

        {/* Erreur */}
        {error && (
          <p className="text-red-500 text-center text-sm bg-red-50 p-3 rounded-xl">{error}</p>
        )}

        {/* Bouton publier */}
        <button onClick={handlePublier} disabled={saving} className="btn-primary">
          📢 {saving ? tx.publication : tx.publier}
        </button>
      </div>
    </div>
  )
}

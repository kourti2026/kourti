import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'

export default function ModifierProfil() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef  = useRef()

  const [form, setForm] = useState({
    prenom:          profile?.prenom || '',
    nom:             profile?.nom || '',
    phone2:          profile?.phone2 || '',
    phone2_whatsapp: profile?.phone2_whatsapp || false,
    bio:             profile?.bio || '',
    annee_debut:     profile?.annee_debut || '',
    langue:          profile?.langue || 'ar',
  })
  const [photo,    setPhoto]    = useState(null)
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url || null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const lang = form.langue
  const t = {
    fr: {
      titre:        'Modifier mon profil',
      photo:        'Photo de profil',
      changerPhoto: 'Changer la photo',
      prenom:       'Prénom',
      nom:          'Nom',
      phone1:       'Numéro principal (identifiant)',
      phone2:       'Deuxième numéro (optionnel)',
      whatsapp:     'Ce numéro est sur WhatsApp',
      bio:          'Présentation (visible sur votre profil public)',
      bioPlaceholder: 'Ex : Éleveur depuis 10 ans, hangar de 5000 places à Bouira…',
      annee:        'Année de début d\'activité',
      experience:   'ans d\'expérience affichés',
      langue:       'Langue de l\'application',
      enregistrer:  'Enregistrer',
      retour:       'Retour',
    },
    ar: {
      titre:        'تعديل ملفي الشخصي',
      photo:        'الصورة الشخصية',
      changerPhoto: 'تغيير الصورة',
      prenom:       'الاسم',
      nom:          'اللقب',
      phone1:       'الرقم الرئيسي (معرّف الحساب)',
      phone2:       'رقم ثاني (اختياري)',
      whatsapp:     'هذا الرقم على واتساب',
      bio:          'تعريف (يظهر في ملفك العام)',
      bioPlaceholder: 'مثال: مربي منذ 10 سنوات، هنكار 5000 رأس في البويرة…',
      annee:        'سنة بداية النشاط',
      experience:   'سنوات خبرة معروضة',
      langue:       'لغة التطبيق',
      enregistrer:  'حفظ',
      retour:       'رجوع',
    },
  }
  const tx = t[lang]
  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const anciennete = form.annee_debut && Number(form.annee_debut) > 1950
    ? new Date().getFullYear() - Number(form.annee_debut)
    : null

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      let url = profile?.photo_url || null
      if (photo) {
        const ext = photo.name.split('.').pop()
        const filename = `${profile.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(filename, photo, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename)
        // cache-bust : la photo remplace l'ancienne sous le même nom
        url = `${urlData.publicUrl}?t=${Date.now()}`
      }

      const { error: dbErr } = await supabase.from('users').update({
        prenom:          form.prenom.trim() || profile.prenom,
        nom:             form.nom.trim() || profile.nom,
        phone2:          form.phone2.trim() || null,
        phone2_whatsapp: form.phone2.trim() ? form.phone2_whatsapp : false,
        bio:             form.bio.trim() || null,
        annee_debut:     form.annee_debut ? Number(form.annee_debut) : null,
        langue:          form.langue,
        photo_url:       url,
      }).eq('id', profile.id)
      if (dbErr) throw dbErr

      await refreshProfile()
      navigate('/profil')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Erreur. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg pb-10">
      {/* Header */}
      <div className="bg-kourti-orange text-white px-4 pt-10 pb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <h1 className="text-xl font-bold">{tx.titre}</h1>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Photo de profil */}
        <div className="card flex flex-col items-center py-6">
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          <button onClick={() => fileRef.current.click()} className="relative">
            {photoUrl ? (
              <img src={photoUrl} alt="profil"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-orange-200" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-orange-100 flex items-center justify-center
                              text-4xl font-bold text-kourti-orange ring-4 ring-orange-200">
                {profile?.prenom?.[0]}{profile?.nom?.[0]}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-9 h-9 bg-kourti-orange text-white
                             rounded-full flex items-center justify-center text-lg shadow">📷</span>
          </button>
          <p className="text-xs text-gray-400 mt-3">{tx.changerPhoto}</p>
        </div>

        {/* Identité */}
        <div className="card space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.prenom}</p>
            <input value={form.prenom} onChange={e => f('prenom', e.target.value)} className="input-field" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.nom}</p>
            <input value={form.nom} onChange={e => f('nom', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Téléphones */}
        <div className="card space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.phone1}</p>
            <input value={profile?.phone || ''} disabled
              className="input-field bg-gray-50 text-gray-400" style={{ direction: 'ltr' }} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">{tx.phone2}</p>
            <input
              type="tel" inputMode="tel" placeholder="05 XX XX XX XX"
              value={form.phone2}
              onChange={e => f('phone2', e.target.value)}
              className="input-field" style={{ direction: 'ltr' }}
            />
          </div>
          {form.phone2.trim() && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">🟢 {tx.whatsapp}</span>
              <button onClick={() => f('phone2_whatsapp', !form.phone2_whatsapp)}
                className={`w-12 h-6 rounded-full transition-colors ${form.phone2_whatsapp ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.phone2_whatsapp ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-1">{tx.bio}</p>
          <textarea
            value={form.bio}
            placeholder={tx.bioPlaceholder}
            onChange={e => f('bio', e.target.value.slice(0, 160))}
            rows={3}
            className="input-field resize-none"
          />
          <p className="text-xs text-gray-400 text-left mt-1">{form.bio.length}/160</p>
        </div>

        {/* Année de début → ancienneté */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-1">{tx.annee}</p>
          <input
            type="number" inputMode="numeric" placeholder="ex: 2015"
            value={form.annee_debut}
            onChange={e => f('annee_debut', e.target.value)}
            className="input-field text-center font-bold" style={{ direction: 'ltr' }}
          />
          {anciennete > 0 && (
            <p className="text-xs text-green-600 font-semibold text-center mt-2">
              🏅 {anciennete} {tx.experience}
            </p>
          )}
        </div>

        {/* Langue */}
        <div className="card">
          <p className="text-xs text-gray-400 font-medium mb-2">{tx.langue}</p>
          <div className="flex gap-2">
            {[['ar', 'العربية'], ['fr', 'Français']].map(([v, l]) => (
              <button key={v} onClick={() => f('langue', v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  form.langue === v ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? '...' : `💾 ${tx.enregistrer}`}
        </button>
      </div>
    </div>
  )
}

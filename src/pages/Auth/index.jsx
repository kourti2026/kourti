import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { useAuth } from '../../context/AuthContext'
import PhoneStep     from './PhoneStep'
import OtpStep       from './OtpStep'
import RoleStep      from './RoleStep'
import ProfileStep   from './ProfileStep'
import DisclaimerStep from './DisclaimerStep'

// Étapes du flux d'inscription
const STEPS = {
  PHONE:      'phone',
  OTP:        'otp',
  ROLE:       'role',
  PROFILE:    'profile',
  DISCLAIMER: 'disclaimer',
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { refreshProfile, firebaseUser } = useAuth()

  const [step,         setStep]         = useState(STEPS.PHONE)
  const [confirmation, setConfirmation] = useState(null)
  const [phone,        setPhone]        = useState('')
  const [role,         setRole]         = useState(null)
  const [lang,         setLang]         = useState('ar') // darija par défaut

  // Step 1 → 2 : téléphone envoyé
  const handlePhoneConfirmation = (conf, intlPhone) => {
    setConfirmation(conf)
    setPhone(intlPhone)
    setStep(STEPS.OTP)
  }

  // Step 2 → 3 : OTP vérifié
  const handleOtpSuccess = async () => {
    // Vérifie si l'utilisateur existe déjà dans Supabase
    const { data: existing } = await supabase
      .from('users')
      .select('id, role, wilaya, disclaimer_accepte')
      .eq('phone', phone)
      .single()

    if (existing?.disclaimer_accepte) {
      // Utilisateur existant et complet → accueil
      await refreshProfile()
      navigate(existing.role === 'eleveur' ? '/eleveur' : '/acheteur')
    } else {
      // Nouvel utilisateur → compléter le profil
      setStep(STEPS.ROLE)
    }
  }

  // Step 3 → 4 : rôle choisi
  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
    setStep(STEPS.PROFILE)
  }

  // Step 4 → 5 : profil rempli
  const handleProfileSave = async ({ prenom, nom, wilaya, commune }) => {
    await supabase.from('users').upsert({
      phone,
      role,
      prenom,
      nom,
      wilaya,
      commune,
      langue:              lang,
      disclaimer_accepte:  false,
      nb_transactions:     0,
      note_moyenne:        0,
      badge:               'nouveau',
      nb_recommandations_recues: 0,
    }, { onConflict: 'phone' })

    setStep(STEPS.DISCLAIMER)
  }

  // Step 5 : disclaimer accepté → accueil
  const handleDisclaimerAccept = async () => {
    await supabase
      .from('users')
      .update({ disclaimer_accepte: true })
      .eq('phone', phone)

    await refreshProfile()
    navigate(role === 'eleveur' ? '/eleveur' : '/acheteur')
  }

  return (
    <div className="min-h-screen bg-kourti-orange-bg">
      {/* Sélecteur de langue (visible aux 2 premières étapes) */}
      {(step === STEPS.PHONE || step === STEPS.OTP) && (
        <div className="flex justify-center gap-3 pt-6 pb-2">
          <button
            onClick={() => setLang('ar')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all
              ${lang === 'ar'
                ? 'bg-kourti-orange text-white'
                : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            العربية
          </button>
          <button
            onClick={() => setLang('fr')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all
              ${lang === 'fr'
                ? 'bg-kourti-orange text-white'
                : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            Français
          </button>
        </div>
      )}

      {/* Rendu conditionnel des étapes */}
      {step === STEPS.PHONE && (
        <PhoneStep onConfirmation={handlePhoneConfirmation} lang={lang} />
      )}
      {step === STEPS.OTP && (
        <OtpStep
          confirmation={confirmation}
          phone={phone}
          onSuccess={handleOtpSuccess}
          lang={lang}
        />
      )}
      {step === STEPS.ROLE && (
        <RoleStep onSelect={handleRoleSelect} lang={lang} />
      )}
      {step === STEPS.PROFILE && (
        <ProfileStep onSave={handleProfileSave} lang={lang} />
      )}
      {step === STEPS.DISCLAIMER && (
        <DisclaimerStep onAccept={handleDisclaimerAccept} lang={lang} />
      )}
    </div>
  )
}

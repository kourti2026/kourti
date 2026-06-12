import { useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { auth } from '../../config/firebase'

export default function PhoneStep({ onConfirmation, lang }) {
  const [phone, setPhone]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const t = {
    ar: {
      title:       'مرحبا بك في كورتي',
      subtitle:    'أدخل رقم هاتفك الجزائري',
      placeholder: '07XXXXXXXX',
      btn:         'إرسال الرمز',
      error_fmt:   'أدخل رقم هاتف جزائري صحيح (05, 06 أو 07)',
      error_send:  'خطأ في الإرسال. تحقق من رقمك وحاول مجدداً.',
      sending:     'جاري الإرسال...',
    },
    fr: {
      title:       'Bienvenue sur KOURTI',
      subtitle:    'Entrez votre numéro algérien',
      placeholder: '07XXXXXXXX',
      btn:         'Envoyer le code',
      error_fmt:   'Numéro invalide (doit commencer par 05, 06 ou 07)',
      error_send:  'Erreur d\'envoi. Vérifiez votre numéro et réessayez.',
      sending:     'Envoi en cours...',
    }
  }
  const tx = t[lang] || t.ar

  const getOrCreateVerifier = () => {
    // Toujours recréer pour éviter les états corrompus
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear() } catch (_) {}
      window.recaptchaVerifier = null
    }
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      'recaptcha-container',
      { size: 'invisible', callback: () => {} }
    )
    return window.recaptchaVerifier
  }

  const handleSend = async () => {
    const digits = phone.replace(/\s/g, '')
    if (!/^0[567]\d{8}$/.test(digits)) {
      setError(tx.error_fmt)
      return
    }
    setError('')
    setLoading(true)

    const intlPhone = '+213' + digits.slice(1)

    try {
      const verifier      = getOrCreateVerifier()
      const confirmation  = await signInWithPhoneNumber(auth, intlPhone, verifier)
      onConfirmation(confirmation, intlPhone)
    } catch (err) {
      console.error('Firebase SMS error:', err.code, err.message)
      // Message d'erreur selon le code Firebase
      if (err.code === 'auth/operation-not-allowed') {
        setError('SMS non activé pour l\'Algérie dans Firebase. Voir console.')
      } else if (err.code === 'auth/invalid-phone-number') {
        setError(tx.error_fmt)
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Attendez quelques minutes.')
      } else {
        setError(tx.error_send)
      }
      try { window.recaptchaVerifier?.clear() } catch (_) {}
      window.recaptchaVerifier = null
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen justify-center">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-3">🐔</div>
        <h1 className="text-4xl font-bold text-kourti-green">كورتي</h1>
        <p className="text-gray-500 mt-1 text-sm">KOURTI</p>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          {tx.title}
        </h2>
        <p className="text-center text-gray-500 mb-8">{tx.subtitle}</p>

        <div className="relative mb-4">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">
            🇩🇿 +213
          </span>
          <input
            type="tel"
            inputMode="numeric"
            placeholder={tx.placeholder}
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            className="input-field pr-24 text-left"
            dir="ltr"
            maxLength={10}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleSend}
          disabled={loading || phone.length < 10}
          className="btn-primary"
        >
          {loading ? tx.sending : tx.btn}
        </button>
      </div>

      {/* Recaptcha invisible — doit rester dans le DOM */}
      <div id="recaptcha-container" />
    </div>
  )
}

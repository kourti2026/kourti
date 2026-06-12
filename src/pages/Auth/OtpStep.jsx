import { useState, useRef, useEffect } from 'react'

export default function OtpStep({ confirmation, phone, onSuccess, lang }) {
  const [code, setCode]       = useState(['', '', '', '', '', ''])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer]     = useState(60)
  const inputs                = useRef([])

  const t = {
    ar: {
      title:    'أدخل الرمز',
      subtitle: `تم إرسال رمز إلى ${phone}`,
      btn:      'تحقق',
      error:    'رمز خاطئ. حاول مجدداً.',
      resend:   'إعادة الإرسال',
      wait:     (s) => `إعادة الإرسال خلال ${s}ث`,
      checking: 'جاري التحقق...',
    },
    fr: {
      title:    'Entrez le code',
      subtitle: `Code envoyé au ${phone}`,
      btn:      'Vérifier',
      error:    'Code incorrect. Réessayez.',
      resend:   'Renvoyer le code',
      wait:     (s) => `Renvoi dans ${s}s`,
      checking: 'Vérification...',
    }
  }
  const tx = t[lang] || t.ar

  // Countdown resend
  useEffect(() => {
    if (timer <= 0) return
    const id = setTimeout(() => setTimer(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timer])

  const handleChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[idx] = val
    setCode(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const full = code.join('')
    if (full.length < 6) return
    setLoading(true)
    setError('')
    try {
      await confirmation.confirm(full)
      onSuccess()
    } catch {
      setError(tx.error)
      setCode(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen justify-center">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">📱</div>
        <h2 className="text-2xl font-bold text-gray-800">{tx.title}</h2>
        <p className="text-gray-500 mt-2 text-sm">{tx.subtitle}</p>
      </div>

      {/* Champs OTP */}
      <div className="flex justify-center gap-3 mb-6" dir="ltr">
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={el => inputs.current[idx] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(e.target.value, idx)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200
                       rounded-xl focus:outline-none focus:border-kourti-green bg-white"
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center mb-4">{error}</p>
      )}

      <div className="max-w-sm mx-auto w-full">
        <button
          onClick={handleVerify}
          disabled={loading || code.join('').length < 6}
          className="btn-primary mb-4"
        >
          {loading ? tx.checking : tx.btn}
        </button>

        <button
          disabled={timer > 0}
          className="w-full text-center text-kourti-green font-medium disabled:text-gray-400"
        >
          {timer > 0 ? tx.wait(timer) : tx.resend}
        </button>
      </div>
    </div>
  )
}

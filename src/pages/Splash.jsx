import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Splash() {
  const navigate   = useNavigate()
  const { firebaseUser, profile, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      if (!firebaseUser) {
        navigate('/auth')
      } else if (!profile?.disclaimer_accepte) {
        navigate('/auth')
      } else if (profile.role === 'acheteur') {
        navigate('/acheteur')
      } else if (profile.role === 'both') {
        navigate('/eleveur')  // mode éleveur par défaut
      } else {
        navigate('/eleveur')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [loading, firebaseUser, profile])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-kourti-orange">
      <div className="text-center animate-pulse">
        <div className="text-8xl mb-6">🐔</div>
        <h1 className="text-5xl font-bold text-white mb-2">كورتي</h1>
        <p className="text-green-200 text-lg tracking-widest">KOURTI</p>
      </div>
      <p className="text-green-300 text-sm mt-16 font-arabic">
        بيع وشري بالسعر الصحيح
      </p>
    </div>
  )
}

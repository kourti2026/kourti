import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { supabase } from '../config/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser]   = useState(null)
  const [profile, setProfile]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [nbOffresAcceptees, setNbOffresAcceptees] = useState(0)
  const realtimeChannel = useRef(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        // Cherche le profil dans Supabase
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('phone', user.phoneNumber)
          .single()
        setProfile(data || null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // Écoute globale des offres acceptées pour l'acheteur
  useEffect(() => {
    if (!profile || (profile.role !== 'acheteur' && profile.role !== 'both')) return

    // (permission notifications gérée par NotifBanner)

    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current)
    }

    const notifier = (body) => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('KOURTI كورتي', { body, icon: '/pwa-192x192.png' })
      }
    }
    const fr = profile.langue === 'fr'

    realtimeChannel.current = supabase
      .channel(`global-offres-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'offres',
          filter: `acheteur_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.statut === 'acceptee') {
            setNbOffresAcceptees(n => n + 1)
            notifier(fr ? '🎉 Votre offre a été acceptée !' : '🎉 تم قبول عرضك!')
          }
          if (payload.new.statut === 'contre_offre') {
            setNbOffresAcceptees(n => n + 1)
            notifier(fr
              ? `↔ Contre-offre de l'éleveur : ${payload.new.contre_prix_kg} DA/kg`
              : `↔ اقتراح مضاد من المربي: ${payload.new.contre_prix_kg} دج/كغ`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'transactions',
          filter: `acheteur_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.statut_transaction === 'annulee') {
            notifier(fr
              ? `🚫 Transaction annulée par l'éleveur — ${payload.new.motif_annulation || ''}`
              : `🚫 ألغى المربي الصفقة — ${payload.new.motif_annulation || ''}`)
          }
        }
      )
      .subscribe()

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current)
      }
    }
  }, [profile?.id])

  const logout = async () => {
    if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current)
    await signOut(auth)
    setProfile(null)
    setFirebaseUser(null)
    setNbOffresAcceptees(0)
  }

  const refreshProfile = async () => {
    if (!firebaseUser) return
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('phone', firebaseUser.phoneNumber)
      .single()
    setProfile(data || null)
  }

  const isNewUser    = firebaseUser && !profile
  const isComplete   = firebaseUser && profile && profile.role && profile.wilaya && profile.disclaimer_accepte

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profile,
      loading,
      isNewUser,
      isComplete,
      refreshProfile,
      logout,
      nbOffresAcceptees,
      clearOffresAcceptees: () => setNbOffresAcceptees(0),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

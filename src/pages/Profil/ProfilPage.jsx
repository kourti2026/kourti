import { useAuth } from '../../context/AuthContext'
import ProfilEleveur from './ProfilEleveur'
import ProfilAcheteur from './ProfilAcheteur'

export default function ProfilPage() {
  const { profile } = useAuth()
  if (!profile) return null
  return profile.role === 'acheteur' ? <ProfilAcheteur /> : <ProfilEleveur />
}

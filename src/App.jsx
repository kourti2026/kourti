import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Splash               from './pages/Splash'
import AuthPage             from './pages/Auth'
import AccueilEleveur       from './pages/Eleveur/AccueilEleveur'
import PublierLot           from './pages/Eleveur/PublierLot'
import OffresEleveur        from './pages/Eleveur/OffresEleveur'
import ElevageHub           from './pages/Eleveur/ElevageHub'
import SetupHangar          from './pages/Eleveur/SetupHangar'
import EnregistrementSerie  from './pages/Eleveur/EnregistrementSerie'
import TableauDeBordSerie   from './pages/Eleveur/TableauDeBordSerie'
import SaisieJournaliere    from './pages/Eleveur/SaisieJournaliere'
import PeseeHebdo           from './pages/Eleveur/PeseeHebdo'
import VentePartielle       from './pages/Eleveur/VentePartielle'
import ClotureSerie         from './pages/Eleveur/ClotureSerie'
import CalendrierVaccinal   from './pages/Eleveur/CalendrierVaccinal'
import AccueilAcheteur      from './pages/Acheteur/AccueilAcheteur'
import DetailAnnonce        from './pages/Acheteur/DetailAnnonce'
import FormulaireOffre      from './pages/Acheteur/FormulaireOffre'
import MesOffresAcheteur    from './pages/Acheteur/MesOffresAcheteur'
import DetailTransaction    from './pages/Transaction/DetailTransaction'
import CoursMarche          from './pages/Cours/CoursMarche'
import ProfilPage           from './pages/Profil/ProfilPage'
import ModifierProfil       from './pages/Profil/ModifierProfil'
import ProfilPublic         from './pages/ProfilPublic'
import Forum                from './pages/Forum'
import NotifBanner          from './components/NotifBanner'
import PWAInstallBanner     from './components/PWAInstallBanner'
import HelpButton           from './components/HelpButton'

// Applique dir + lang sur <html> selon la préférence de l'utilisateur
function LangDirectionSync() {
  const { profile } = useAuth()
  useEffect(() => {
    const isAr = !profile || profile.langue !== 'fr'
    document.documentElement.lang = isAr ? 'ar' : 'fr'
    document.body.dir = isAr ? 'rtl' : 'ltr'
  }, [profile?.langue])
  return null
}

function PrivateRoute({ children }) {
  const { firebaseUser, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen" style={{ backgroundColor: '#E85C0D' }} />
  if (!firebaseUser || !profile?.disclaimer_accepte) return <Navigate to="/auth" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"     element={<Splash />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Eleveur — marketplace */}
      <Route path="/eleveur"                       element={<PrivateRoute><AccueilEleveur /></PrivateRoute>} />
      <Route path="/eleveur/publier"               element={<PrivateRoute><PublierLot /></PrivateRoute>} />
      <Route path="/eleveur/offres"                element={<PrivateRoute><OffresEleveur /></PrivateRoute>} />

      {/* Eleveur — module Élevage */}
      <Route path="/eleveur/elevage"                element={<PrivateRoute><ElevageHub /></PrivateRoute>} />
      <Route path="/eleveur/hangar"                 element={<PrivateRoute><SetupHangar /></PrivateRoute>} />
      <Route path="/eleveur/serie/nouvelle"         element={<PrivateRoute><EnregistrementSerie /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId"         element={<PrivateRoute><TableauDeBordSerie /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId/jour"    element={<PrivateRoute><SaisieJournaliere /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId/pesee"   element={<PrivateRoute><PeseeHebdo /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId/vente"   element={<PrivateRoute><VentePartielle /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId/cloture" element={<PrivateRoute><ClotureSerie /></PrivateRoute>} />
      <Route path="/eleveur/serie/:serieId/vaccins" element={<PrivateRoute><CalendrierVaccinal /></PrivateRoute>} />

      {/* Acheteur */}
      <Route path="/acheteur"               element={<PrivateRoute><AccueilAcheteur /></PrivateRoute>} />
      <Route path="/acheteur/lot/:id"       element={<PrivateRoute><DetailAnnonce /></PrivateRoute>} />
      <Route path="/acheteur/lot/:id/offre" element={<PrivateRoute><FormulaireOffre /></PrivateRoute>} />
      <Route path="/acheteur/offres"        element={<PrivateRoute><MesOffresAcheteur /></PrivateRoute>} />

      {/* Commun */}
      <Route path="/transaction/:id" element={<PrivateRoute><DetailTransaction /></PrivateRoute>} />
      <Route path="/cours"           element={<PrivateRoute><CoursMarche /></PrivateRoute>} />
      <Route path="/profil"          element={<PrivateRoute><ProfilPage /></PrivateRoute>} />
      <Route path="/profil/modifier" element={<PrivateRoute><ModifierProfil /></PrivateRoute>} />
      <Route path="/profil/:userId"  element={<PrivateRoute><ProfilPublic /></PrivateRoute>} />
      <Route path="/forum"           element={<PrivateRoute><Forum /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LangDirectionSync />
        <NotifBanner />
        <PWAInstallBanner />
        <HelpButton />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

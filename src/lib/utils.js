// Calcule l'âge actuel des sujets en jours
export function calcAge(ageInitial, datePublication) {
  const pub   = new Date(datePublication)
  const now   = new Date()
  const jours = Math.floor((now - pub) / (1000 * 60 * 60 * 24))
  return ageInitial + jours
}

// Formate un montant en DA
export function formatDA(montant) {
  return new Intl.NumberFormat('fr-DZ').format(Math.round(montant)) + ' DA'
}

// Badge couleur selon l'âge
export function ageBadge(age) {
  if (age <= 42) return { color: 'bg-green-100 text-green-700',  label: '✓ Optimal' }
  if (age <= 52) return { color: 'bg-yellow-100 text-yellow-700', label: '⚠ Attention' }
  if (age <= 60) return { color: 'bg-orange-100 text-orange-700', label: '⚠ Urgent' }
  return           { color: 'bg-red-100 text-red-700',    label: '🚨 Critique' }
}

// Taux de présence : transactions honorées vs annulations (no-show)
// Retourne null si aucune donnée (nouveau profil)
export function tauxPresence(user) {
  const ok = user?.nb_transactions || 0
  const ko = user?.nb_annulations || 0
  if (ok + ko === 0) return null
  return Math.round((ok / (ok + ko)) * 100)
}

// Formatte un créneau date+heure
export function formatDateTime(iso, lang = 'ar') {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Temps restant avant expiration — "5 h" / "32 min", null si dépassé
export function tempsRestant(expiresAt, lang = 'ar') {
  if (!expiresAt) return null
  const ms = new Date(expiresAt) - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  if (h >= 1) return lang === 'fr' ? `${h} h` : `${h} سا`
  const min = Math.max(1, Math.floor(ms / 60000))
  return lang === 'fr' ? `${min} min` : `${min} د`
}

// Indicateur offre vs cours
export function offreIndicateur(prixOffre, coursMin, coursMax) {
  const mid = (coursMin + coursMax) / 2
  if (prixOffre >= coursMax)        return { icon: '↑↑', color: 'text-green-600',  label: 'ممتازة' }
  if (prixOffre >= mid)             return { icon: '↑',  color: 'text-green-500',  label: 'جيدة' }
  if (prixOffre >= coursMin)        return { icon: '→',  color: 'text-blue-500',   label: 'متوسطة' }
  if (prixOffre >= coursMin * 0.95) return { icon: '↓',  color: 'text-orange-500', label: 'منخفضة' }
  return                                   { icon: '↓↓', color: 'text-red-600',    label: 'ارفض' }
}

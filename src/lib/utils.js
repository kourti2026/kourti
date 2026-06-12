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

// Montant en "millions" de centimes — l'unité de compte des éleveurs
// (1 million de centimes = 10 000 DA). Retourne null sous 10 000 DA.
export function formatMillions(da, lang = 'ar') {
  if (da == null || da < 10000) return null
  const m = Math.round(da / 10000)
  return lang === 'fr' ? `${m.toLocaleString('fr-DZ')} millions` : `${m.toLocaleString('fr-DZ')} مليون`
}

// Lecture vocale — synthèse intégrée au téléphone, gratuite
export function lire(texte, lang = 'ar') {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texte)
    u.lang = lang === 'fr' ? 'fr-FR' : 'ar'
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch { /* navigateur sans synthèse vocale */ }
}

// Messages d'erreur en langage humain (jamais de code technique à l'écran)
export function messageErreur(err, lang = 'ar') {
  const msg = err?.message || String(err || '')
  const fr = lang === 'fr'
  if (msg.includes('MAX_TRANSACTIONS'))
    return fr ? 'Vous avez déjà 3 transactions en cours — clôturez-en une d\'abord.' : 'عندك 3 صفقات جارية — سالي وحدة قبل.'
  if (msg.includes('STOCK_EPUISE'))
    return fr ? 'Plus de sujets disponibles sur cette annonce.' : 'ما بقاش رؤوس متاحة في هذا الإعلان.'
  if (msg.includes('OFFRE_DEJA_TRAITEE') || msg.includes('OFFRE_INTROUVABLE'))
    return fr ? 'Cette offre a déjà été traitée.' : 'هذا العرض تمت معالجته من قبل.'
  if (msg.includes('ANNULATION_IMPOSSIBLE'))
    return fr ? 'Cette transaction ne peut plus être annulée.' : 'ما يمكنش تلغي هذه الصفقة الآن.'
  if (msg.includes('MOTIF_OBLIGATOIRE'))
    return fr ? 'Indiquez le motif de l\'annulation.' : 'اكتب سبب الإلغاء.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
    return fr ? 'Pas de connexion internet — réessayez.' : 'ما كاش إنترنت — عاود من بعد.'
  return fr ? 'Une erreur est survenue. Réessayez.' : 'وقع خطأ. عاود المحاولة.'
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

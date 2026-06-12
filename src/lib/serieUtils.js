// ─── Courbes référence poids (g) par souche ──────────────────────────────────
export const POIDS_REF = {
  'Ross 308':    { 0:42,1:57,3:90,7:190,10:310,14:450,17:600,21:850,24:1050,28:1380,31:1600,35:1900,38:2150,42:2500,45:2750 },
  'Cobb 500':    { 0:42,7:195,14:460,21:870,28:1400,35:1950,42:2550,45:2800 },
  'Hubbard':     { 0:42,7:185,14:440,21:830,28:1350,35:1860,42:2440,45:2690 },
  'Arbor Acres': { 0:42,7:188,14:445,21:840,28:1360,35:1880,42:2470,45:2720 },
}

function interpolerRef(refData, jour) {
  const jours = Object.keys(refData).map(Number).sort((a, b) => a - b)
  const j0 = [...jours].reverse().find(j => j <= jour) ?? 0
  const j1 = jours.find(j => j > jour) ?? jours[jours.length - 1]
  if (j0 === j1) return refData[j0]
  return refData[j0] + ((jour - j0) / (j1 - j0)) * (refData[j1] - refData[j0])
}

// Poids estimé en grammes — retourne { poids_g, mesure: bool }
export function poidsEstime(souche, jour, pesees = []) {
  const exacte = pesees.find(p => p.jour === jour)
  if (exacte) return { poids_g: exacte.poids_moyen_kg * 1000, mesure: true }

  const ref   = POIDS_REF[souche] || POIDS_REF['Ross 308']
  const avant = [...pesees].filter(p => p.jour < jour).sort((a, b) => b.jour - a.jour)[0]
  const apres = [...pesees].filter(p => p.jour > jour).sort((a, b) => a.jour - b.jour)[0]

  if (avant && apres) {
    const r = (jour - avant.jour) / (apres.jour - avant.jour)
    return { poids_g: avant.poids_moyen_kg*1000 + r*(apres.poids_moyen_kg*1000 - avant.poids_moyen_kg*1000), mesure: false }
  }
  if (avant) {
    const ra = interpolerRef(ref, avant.jour)
    const rj = interpolerRef(ref, jour)
    return { poids_g: avant.poids_moyen_kg * 1000 * (ra > 0 ? rj / ra : 1), mesure: false }
  }
  return { poids_g: interpolerRef(ref, jour), mesure: false }
}

// Calcul central de la série
export function calcSerie(bande, jours = [], pesees = []) {
  const today  = new Date()
  const start  = new Date(bande.date_mise_en_place)
  const age    = Math.floor((today - start) / 86400000)
  const depart = bande.nb_sujets_depart || bande.nb_sujets || 0

  const mortCum    = jours.reduce((s, j) => s + (j.mortalite_jour || 0), 0)
  const vivants    = depart - mortCum
  const tauxMort   = depart > 0 ? (mortCum / depart) * 100 : 0

  const sacsCumul  = jours.reduce((s, j) => s + (j.sacs_aliment || 0), 0)
  const alimentKg  = sacsCumul * 50
  const bouteilles = jours.reduce((s, j) => s + (j.bouteilles_gaz || 0), 0)

  const { poids_g, mesure: poidsMesure } = poidsEstime(bande.souche || 'Ross 308', age, pesees)
  const poidsMoyen_kg = poids_g / 1000

  const gainMasse_kg = vivants > 0 ? (vivants * (poids_g - 42)) / 1000 : 0
  const ic  = gainMasse_kg > 0 ? alimentKg / gainMasse_kg : null
  const gmq = age > 0 ? (poids_g - 42) / age : 0

  const survie_pct = depart > 0 ? (vivants / depart) * 100 : 0
  const ipe = ic && age > 0 ? (survie_pct * poidsMoyen_kg * 100) / (ic * age) : null

  // Coûts
  const coutPoussins = depart * (bande.prix_poussin_da || 0)
  const coutAliment  = sacsCumul * (bande.prix_sac_aliment_da || 0)
  const coutGaz      = bouteilles * (bande.prix_bouteille_gaz_da || 0)
  const coutDivers   = Number(bande.charges_diverses_da) || 0
  const coutTotal    = coutPoussins + coutAliment + coutGaz + coutDivers

  const poidsDispo_kg = vivants * poidsMoyen_kg
  const prixSeuil     = poidsDispo_kg > 0 ? coutTotal / poidsDispo_kg : null

  // Coût journalier estimé (aliment + gaz)
  const coutAlimentJour = bande.prix_sac_aliment_da
    ? ((poidsMoyen_kg * 0.1 * vivants) / 50) * bande.prix_sac_aliment_da
    : 0
  const coutGazJour = (bouteilles > 0 && age > 0)
    ? (bouteilles / age) * (bande.prix_bouteille_gaz_da || 0)
    : 0
  const coutJour = coutAlimentJour + coutGazJour

  return {
    age, depart, vivants, mortCum, tauxMort, survie_pct,
    sacsCumul, alimentKg, bouteilles,
    poids_g, poidsMoyen_kg, poidsMesure,
    gainMasse_kg, ic, ipe, gmq,
    coutPoussins, coutAliment, coutGaz, coutDivers, coutTotal,
    prixSeuil, poidsDispo_kg, coutJour,
  }
}

// Alertes intelligentes
export function calcAlertes(stats, bande) {
  const alertes = []
  const { age, tauxMort, ic, gmq, coutJour } = stats
  const delai = bande.delai_publication_jours || 35

  if (tauxMort > 5)
    alertes.push({ type: 'rouge', fr: `Mortalité ${tauxMort.toFixed(1)}% — Appeler le vétérinaire`, ar: `نفوق ${tauxMort.toFixed(1)}% — اتصل بالطبيب البيطري` })
  else if (tauxMort > 3)
    alertes.push({ type: 'orange', fr: `Mortalité ${tauxMort.toFixed(1)}% — À surveiller`, ar: `نفوق ${tauxMort.toFixed(1)}% — مراقبة` })

  if (ic !== null && ic > 2.1)
    alertes.push({ type: 'rouge', fr: `IC ${ic.toFixed(2)} — Appeler le vétérinaire`, ar: `م.ت ${ic.toFixed(2)} — اتصل بالطبيب البيطري` })
  else if (ic !== null && ic > 1.9)
    alertes.push({ type: 'orange', fr: `IC ${ic.toFixed(2)} — À surveiller`, ar: `م.ت ${ic.toFixed(2)} — مراقبة` })

  if (age > 14 && gmq < 40)
    alertes.push({ type: 'orange', fr: `GMQ ${gmq.toFixed(0)} g/j — Croissance insuffisante`, ar: `نمو ${gmq.toFixed(0)} غ/يوم — بطيء` })

  if (age > delai && coutJour > 0)
    alertes.push({ type: 'rouge', fr: `J+${age} — Coût ${Math.round(coutJour).toLocaleString()} DA/jour — Vends maintenant !`, ar: `اليوم +${age} — التكلفة ${Math.round(coutJour).toLocaleString()} دج/يوم — بع الآن!` })
  else if (age >= delai - 3 && age <= delai)
    alertes.push({ type: 'vert', fr: `Lot prêt dans ${delai - age} jour(s) — Prépare ta publication`, ar: `القطيع جاهز في ${delai - age} أيام — أعد النشر` })

  return alertes
}

// Prochain vaccin à venir
export function prochainVaccin(vaccins = [], age = 0) {
  return vaccins
    .filter(v => !v.fait && v.jour_prevu > age)
    .sort((a, b) => a.jour_prevu - b.jour_prevu)[0] || null
}

// Couleur IC
export function icColor(ic) {
  if (ic === null) return 'text-gray-400'
  if (ic < 1.80) return 'text-green-700'
  if (ic < 1.90) return 'text-green-500'
  if (ic < 2.10) return 'text-orange-500'
  return 'text-red-500'
}

export const formatDA = (n) => n != null ? Math.round(n).toLocaleString('fr-DZ') + ' DA' : '—'
export const formatKg = (n, d = 2) => n != null ? n.toFixed(d) + ' kg' : '—'

// ─── Consommation théorique d'aliment (g/tête/jour) ──────────────────────────
// Basé sur les normes Ross 308 / conditions algériennes
const ALIMENT_G_JOUR = {
   1:13,  2:14,  3:15,  4:16,  5:17,  6:18,  7:19,
   8:22,  9:25, 10:28, 11:30, 12:32, 13:34, 14:36,
  15:42, 16:47, 17:52, 18:56, 19:60, 20:64, 21:68,
  22:74, 23:79, 24:84, 25:89, 26:94, 27:98, 28:103,
  29:109,30:114,31:119,32:124,33:128,34:132,35:137,
  36:141,37:145,38:149,39:153,40:155,41:157,42:160,
}

/**
 * Prévision aliment 7 jours à partir de demain.
 * @param {number} ageCourant  - âge actuel en jours
 * @param {number} vivants     - nombre de têtes vivantes
 * @param {string} dateDepart  - date_mise_en_place ISO string
 * @returns {Array<{jour, date, g_par_tete, kg_total, sacs}>}
 */
export function previsionAliment(ageCourant, vivants, dateDepart) {
  const start = new Date(dateDepart)
  return Array.from({ length: 7 }, (_, i) => {
    const jourNum  = ageCourant + i + 1
    const g        = ALIMENT_G_JOUR[Math.min(jourNum, 42)] || 160
    const kg_total = (vivants * g) / 1000
    const sacs     = kg_total / 50
    const date     = new Date(start)
    date.setDate(date.getDate() + jourNum)
    return {
      jour: jourNum,
      date: date.toLocaleDateString('fr-DZ', { weekday: 'short', day: 'numeric', month: 'short' }),
      g_par_tete: g,
      kg_total: Math.round(kg_total),
      sacs: sacs,
    }
  })
}

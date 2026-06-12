// ─── Mise en vente d'une série ────────────────────────────────────────────────
// Processus : l'éleveur gère sa série ; à l'échéance (J+35 par défaut) la mise
// en vente se fait automatiquement. Une annonce ne peut être créée QUE depuis
// la série en place.

import { supabase } from '../config/supabase'
import { calcSerie } from './serieUtils'

// Série "en place" de l'éleveur (en cours d'élevage ou déjà mise en vente)
export async function getSerieEnPlace(eleveurId) {
  const { data } = await supabase
    .from('bandes')
    .select('*')
    .eq('eleveur_id', eleveurId)
    .in('statut', ['en_cours', 'publiee'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

// Stats calculées de la série (âge, vivants, poids estimé…)
export async function getStatsSerie(bande) {
  const [{ data: jours }, { data: pesees }] = await Promise.all([
    supabase.from('bande_jours').select('*').eq('bande_id', bande.id),
    supabase.from('bande_pesees').select('*').eq('bande_id', bande.id),
  ])
  return calcSerie(bande, jours || [], pesees || [])
}

// Marque expirées les offres/contre-offres dont le délai est dépassé.
// Appelé au chargement des listes (filet : cron SQL optionnel).
export async function expirerOffres() {
  try { await supabase.rpc('expirer_offres') } catch { /* non bloquant */ }
}

// Crée l'annonce de vente à partir de la série. source: 'auto' | 'manuelle'
export async function publierSerie({ profile, bande, stats, photoUrl = null, note = null, source = 'manuelle', prixAuto = null }) {
  // Une seule annonce active par éleveur
  const { data: existante } = await supabase
    .from('annonces')
    .select('id')
    .eq('eleveur_id', profile.id)
    .eq('statut', 'active')
    .limit(1)
    .maybeSingle()
  if (existante) return { annonce: existante, deja: true }

  const { data: annonce, error } = await supabase
    .from('annonces')
    .insert({
      eleveur_id:         profile.id,
      bande_id:           bande.id,
      wilaya:             profile.wilaya,
      commune:            profile.commune,
      nb_sujets_initial:  stats.vivants,
      nb_sujets_restants: stats.vivants,
      poids_moyen:        Math.round(stats.poidsMoyen_kg * 10) / 10,
      souche:             bande.souche || null,
      age_initial_sujets: stats.age,
      photos:             photoUrl ? [photoUrl] : null,
      note_libre:         note || null,
      statut:             'active',
      source,
      prix_acceptation_auto: prixAuto || null,
    })
    .select()
    .single()
  if (error) throw error

  await supabase.from('bandes').update({ statut: 'publiee' }).eq('id', bande.id)
  return { annonce, deja: false }
}

// Mise en vente automatique si la série a atteint son échéance.
// Fallback côté client de la fonction SQL publier_bandes_auto (cron).
export async function autoPublierSiEcheance(profile) {
  const { data: bande } = await supabase
    .from('bandes')
    .select('*')
    .eq('eleveur_id', profile.id)
    .eq('statut', 'en_cours')
    .eq('publication_auto_activee', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!bande) return null

  const stats = await getStatsSerie(bande)
  const delai = bande.delai_publication_jours || 35
  if (stats.age < delai || stats.vivants <= 0) return null

  try {
    const { annonce, deja } = await publierSerie({ profile, bande, stats, source: 'auto' })
    return deja ? null : annonce
  } catch {
    return null
  }
}

// Meilleure offre en attente par annonce — { [annonce_id]: prix_kg max }
export async function getMeilleuresOffres(annonceIds) {
  if (!annonceIds?.length) return {}
  const { data } = await supabase
    .from('offres')
    .select('annonce_id, prix_kg')
    .in('annonce_id', annonceIds)
    .eq('statut', 'en_attente')
  const map = {}
  data?.forEach(o => {
    if (!map[o.annonce_id] || o.prix_kg > map[o.annonce_id]) map[o.annonce_id] = o.prix_kg
  })
  return map
}

-- ═══════════════════════════════════════════════════════════════════
-- KOURTI — Mise en vente automatique des séries (processus simplifié)
-- À exécuter dans Supabase > SQL Editor
--
-- Processus : l'éleveur gère sa série ; à J+35 (delai_publication_jours)
-- l'annonce de vente est créée automatiquement depuis la série.
-- Les acheteurs soumettent leurs offres (enchères visibles), l'éleveur
-- accepte ou refuse. Une annonce ne peut venir QUE d'une série.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Réécriture de publier_bandes_auto ────────────────────────────
-- L'ancienne version lisait la table legacy bande_updates et omettait
-- des colonnes NOT NULL (nb_sujets_initial, age_initial_sujets).
-- Cette version calcule depuis bande_jours (mortalité) et bande_pesees
-- (dernier poids mesuré, sinon estimation par l'âge).
-- À planifier chaque jour via pg_cron ; l'app a aussi un fallback client.

CREATE OR REPLACE FUNCTION publier_bandes_auto()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b RECORD;
  v_age      INTEGER;
  v_vivants  INTEGER;
  v_poids_kg NUMERIC;
BEGIN
  FOR b IN
    SELECT bd.*, u.wilaya AS u_wilaya, u.commune AS u_commune
    FROM   bandes bd
    JOIN   users u ON u.id = bd.eleveur_id
    WHERE  bd.statut = 'en_cours'
      AND  bd.publication_auto_activee = TRUE
      AND  CURRENT_DATE - bd.date_mise_en_place >= COALESCE(bd.delai_publication_jours, 35)
      -- une seule annonce active par éleveur
      AND  NOT EXISTS (
        SELECT 1 FROM annonces a
        WHERE a.eleveur_id = bd.eleveur_id AND a.statut = 'active'
      )
  LOOP
    v_age := CURRENT_DATE - b.date_mise_en_place;

    -- Sujets vivants = départ - mortalité cumulée
    SELECT b.nb_sujets_initial - COALESCE(SUM(j.mortalite_jour), 0)
    INTO   v_vivants
    FROM   bande_jours j WHERE j.bande_id = b.id;

    IF v_vivants IS NULL THEN v_vivants := b.nb_sujets_initial; END IF;
    IF v_vivants <= 0 THEN CONTINUE; END IF;

    -- Dernier poids mesuré, sinon estimation simple par l'âge (Ross 308)
    SELECT p.poids_moyen_kg INTO v_poids_kg
    FROM   bande_pesees p
    WHERE  p.bande_id = b.id
    ORDER  BY p.jour DESC LIMIT 1;

    IF v_poids_kg IS NULL THEN
      v_poids_kg := CASE
        WHEN v_age >= 42 THEN 2.5
        WHEN v_age >= 40 THEN 2.3
        WHEN v_age >= 38 THEN 2.1
        WHEN v_age >= 35 THEN 1.9
        ELSE ROUND(v_age * 0.054, 1)
      END;
    END IF;

    INSERT INTO annonces (
      eleveur_id, bande_id, wilaya, commune,
      nb_sujets_initial, nb_sujets_restants,
      poids_moyen, souche, age_initial_sujets,
      statut, source, expires_at
    ) VALUES (
      b.eleveur_id, b.id, b.u_wilaya, b.u_commune,
      v_vivants, v_vivants,
      ROUND(v_poids_kg, 1), b.souche, v_age,
      'active', 'auto', NOW() + INTERVAL '21 days'
    );

    UPDATE bandes SET statut = 'publiee' WHERE id = b.id;
  END LOOP;
END;
$$;

-- ─── 2. Index pour les enchères (offres affichées sur l'annonce) ─────
CREATE INDEX IF NOT EXISTS idx_offres_annonce_statut
  ON offres(annonce_id, statut);

-- ─── 3. Nettoyage du flux legacy "bande marketplace" ─────────────────
-- La table bande_updates n'est plus utilisée par l'application
-- (remplacée par bande_jours / bande_pesees du module série).
-- Décommentez pour la supprimer définitivement :
-- DROP TABLE IF EXISTS bande_updates;

-- ─── 4. Planification quotidienne (si pg_cron est activé) ────────────
-- SELECT cron.schedule('publier-bandes-auto', '0 6 * * *', 'SELECT publier_bandes_auto()');

-- ═══════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- KOURTI — Correction du processus de vente
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colonne statut_transaction dans transactions ────────────────
-- La table transactions existante n'avait que statut_paiement.
-- On ajoute statut_transaction pour piloter les étapes : accord → chargement → pesee → cloture

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS statut_transaction TEXT NOT NULL DEFAULT 'accord'
  CHECK (statut_transaction IN ('accord','chargement','pesee','cloture'));

-- ─── 2. Index utile pour la requête "tx en cours" de l'éleveur ──────
CREATE INDEX IF NOT EXISTS idx_transactions_eleveur_statut
  ON transactions(eleveur_id, statut_transaction);

-- ─── 3. RPC increment_nb_transactions ───────────────────────────────
-- Appelée après chaque transaction clôturée pour les deux parties

CREATE OR REPLACE FUNCTION increment_nb_transactions(user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE users
  SET nb_transactions = nb_transactions + 1
  WHERE id = user_id;
END;
$$;

-- ─── 4. RPC cloturer_annonce ─────────────────────────────────────────
-- Appelée lors de la clôture d'une transaction.
-- Déduit les sujets vendus du nb_sujets_restants de l'annonce.
-- Si nb_sujets_restants = 0, passe l'annonce en 'vendue'.
-- Sinon, reste 'active' (vente partielle).

CREATE OR REPLACE FUNCTION cloturer_annonce(p_transaction_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_annonce_id UUID;
  v_quantite   INTEGER;
  v_restants   INTEGER;
BEGIN
  -- Récupère l'annonce et la quantité vendue
  SELECT t.annonce_id, t.quantite_reelle_pesee
  INTO   v_annonce_id, v_quantite
  FROM   transactions t
  WHERE  t.id = p_transaction_id;

  IF v_annonce_id IS NULL THEN RETURN; END IF;

  -- Utilise quantite_accordee si la pesée n'a pas été saisie
  IF v_quantite IS NULL THEN
    SELECT t.quantite_accordee INTO v_quantite
    FROM   transactions t WHERE t.id = p_transaction_id;
  END IF;

  -- Décrémente le stock de l'annonce
  UPDATE annonces
  SET    nb_sujets_restants = GREATEST(0, nb_sujets_restants - COALESCE(v_quantite, 0))
  WHERE  id = v_annonce_id;

  -- Si plus de sujets disponibles → marque comme vendue
  SELECT nb_sujets_restants INTO v_restants
  FROM   annonces WHERE id = v_annonce_id;

  IF v_restants = 0 THEN
    UPDATE annonces SET statut = 'vendue' WHERE id = v_annonce_id;
  END IF;
END;
$$;

-- ─── 5. RPC maj_statut_annonce (si pas encore créée) ─────────────────
-- Appelée pour suspendre ou clôturer manuellement une annonce

CREATE OR REPLACE FUNCTION maj_statut_annonce(
  p_annonce_id UUID,
  p_statut     TEXT,
  p_nb_sujets  INTEGER DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_nb_sujets IS NOT NULL THEN
    UPDATE annonces
    SET statut = p_statut, nb_sujets_restants = p_nb_sujets
    WHERE id = p_annonce_id;
  ELSE
    UPDATE annonces SET statut = p_statut WHERE id = p_annonce_id;
  END IF;
END;
$$;

-- ─── 6. RLS pour les nouvelles tables du module série ─────────────────
-- (à exécuter si le script kourti_serie_module.sql a été joué avant ce fichier)

-- bandes
DROP POLICY IF EXISTS "eleveur_own_bandes"   ON bandes;
DROP POLICY IF EXISTS "eleveur_own_updates"  ON bande_updates;

CREATE POLICY "bandes_all"        ON bandes        FOR ALL USING (TRUE);
CREATE POLICY "bande_updates_all" ON bande_updates FOR ALL USING (TRUE);

-- bande_jours (saisies journalières)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bande_jours') THEN
    ALTER TABLE bande_jours ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "bande_jours_all" ON bande_jours';
    EXECUTE 'CREATE POLICY "bande_jours_all" ON bande_jours FOR ALL USING (TRUE)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bande_pesees') THEN
    ALTER TABLE bande_pesees ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "bande_pesees_all" ON bande_pesees';
    EXECUTE 'CREATE POLICY "bande_pesees_all" ON bande_pesees FOR ALL USING (TRUE)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bande_vaccins') THEN
    ALTER TABLE bande_vaccins ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "bande_vaccins_all" ON bande_vaccins';
    EXECUTE 'CREATE POLICY "bande_vaccins_all" ON bande_vaccins FOR ALL USING (TRUE)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bande_ventes') THEN
    ALTER TABLE bande_ventes ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "bande_ventes_all" ON bande_ventes';
    EXECUTE 'CREATE POLICY "bande_ventes_all" ON bande_ventes FOR ALL USING (TRUE)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════

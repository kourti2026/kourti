-- ═══════════════════════════════════════════════════════════════════
-- KOURTI — Enchères V2 : réservation de stock, créneau de chargement,
-- annulation manuelle avec motif, contre-offre, profil enrichi
-- À exécuter dans Supabase > SQL Editor (après supabase_vente_auto.sql)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. OFFRES : créneau de chargement + contre-offre ────────────────
ALTER TABLE offres
  ADD COLUMN IF NOT EXISTS date_chargement_prevue TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contre_prix_kg         NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS contre_quantite        INTEGER,
  ADD COLUMN IF NOT EXISTS contre_date            TIMESTAMPTZ;

-- Nouveaux statuts : contre_offre (en attente de réponse acheteur), annulee
ALTER TABLE offres DROP CONSTRAINT IF EXISTS offres_statut_check;
ALTER TABLE offres ADD CONSTRAINT offres_statut_check
  CHECK (statut IN ('en_attente','contre_offre','acceptee','refusee','expiree','annulee'));

-- ─── 2. TRANSACTIONS : annulation + créneau + horodatage clôture ─────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS date_chargement_prevue TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motif_annulation       TEXT,
  ADD COLUMN IF NOT EXISTS date_annulation        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_cloture           TIMESTAMPTZ;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_statut_transaction_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_statut_transaction_check
  CHECK (statut_transaction IN ('accord','chargement','pesee','cloture','annulee'));

-- ─── 3. USERS : profil enrichi + taux de présence ────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS phone2          TEXT,
  ADD COLUMN IF NOT EXISTS phone2_whatsapp BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio             TEXT,
  ADD COLUMN IF NOT EXISTS annee_debut     INTEGER,
  ADD COLUMN IF NOT EXISTS nb_annulations  INTEGER DEFAULT 0;

-- ─── 4. RPC accepter_offre ────────────────────────────────────────────
-- Acceptation atomique :
--   · max 3 transactions en cours par éleveur (gérable)
--   · quantité plafonnée au stock restant de l'annonce
--   · le stock est RÉSERVÉ immédiatement (déduit à l'acceptation)
--   · les autres offres restent en attente (pas de refus automatique)
-- Retourne l'id de la transaction créée.

CREATE OR REPLACE FUNCTION accepter_offre(p_offre_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offre    offres%ROWTYPE;
  v_restants INTEGER;
  v_en_cours INTEGER;
  v_quantite INTEGER;
  v_prix     NUMERIC;
  v_tx_id    UUID;
BEGIN
  SELECT * INTO v_offre FROM offres WHERE id = p_offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN
    RAISE EXCEPTION 'OFFRE_INTROUVABLE';
  END IF;
  IF v_offre.statut NOT IN ('en_attente','contre_offre') THEN
    RAISE EXCEPTION 'OFFRE_DEJA_TRAITEE';
  END IF;

  -- Limite : 3 transactions en cours max pour l'éleveur
  SELECT COUNT(*) INTO v_en_cours
  FROM   transactions
  WHERE  eleveur_id = v_offre.eleveur_id
    AND  statut_transaction NOT IN ('cloture','annulee');
  IF v_en_cours >= 3 THEN
    RAISE EXCEPTION 'MAX_TRANSACTIONS';
  END IF;

  -- Verrouille l'annonce et plafonne au stock restant
  SELECT nb_sujets_restants INTO v_restants
  FROM   annonces WHERE id = v_offre.annonce_id FOR UPDATE;
  IF v_restants IS NULL OR v_restants <= 0 THEN
    RAISE EXCEPTION 'STOCK_EPUISE';
  END IF;

  v_quantite := LEAST(v_offre.quantite, v_restants);
  -- Si contre-offre acceptée côté acheteur, les conditions contre priment
  v_prix := COALESCE(v_offre.contre_prix_kg, v_offre.prix_kg);
  IF v_offre.contre_quantite IS NOT NULL THEN
    v_quantite := LEAST(v_offre.contre_quantite, v_restants);
  END IF;

  -- Réservation immédiate du stock
  UPDATE annonces
  SET    nb_sujets_restants = nb_sujets_restants - v_quantite
  WHERE  id = v_offre.annonce_id;

  -- Crée la transaction
  INSERT INTO transactions (
    offre_id, annonce_id, eleveur_id, acheteur_id,
    quantite_accordee, prix_kg_reel, statut_transaction, date_chargement_prevue
  ) VALUES (
    v_offre.id, v_offre.annonce_id, v_offre.eleveur_id, v_offre.acheteur_id,
    v_quantite, v_prix, 'accord', v_offre.date_chargement_prevue
  ) RETURNING id INTO v_tx_id;

  UPDATE offres SET statut = 'acceptee', prix_kg = v_prix, quantite = v_quantite
  WHERE  id = v_offre.id;

  RETURN v_tx_id;
END;
$$;

-- ─── 5. RPC annuler_transaction ───────────────────────────────────────
-- Annulation MANUELLE par l'éleveur uniquement, motif obligatoire.
--   · restitue le stock réservé à l'annonce
--   · garde l'historique (motif + date sur la transaction)
--   · incrémente le compteur d'annulations de l'acheteur (taux de présence)

CREATE OR REPLACE FUNCTION annuler_transaction(p_transaction_id UUID, p_motif TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tx transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'TRANSACTION_INTROUVABLE';
  END IF;
  IF v_tx.statut_transaction NOT IN ('accord','chargement') THEN
    RAISE EXCEPTION 'ANNULATION_IMPOSSIBLE';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) = 0 THEN
    RAISE EXCEPTION 'MOTIF_OBLIGATOIRE';
  END IF;

  UPDATE transactions SET
    statut_transaction = 'annulee',
    motif_annulation   = trim(p_motif),
    date_annulation    = NOW()
  WHERE id = p_transaction_id;

  -- Restitue le stock réservé
  UPDATE annonces
  SET    nb_sujets_restants = nb_sujets_restants + COALESCE(v_tx.quantite_accordee, 0)
  WHERE  id = v_tx.annonce_id;

  -- L'offre liée est marquée annulée
  UPDATE offres SET statut = 'annulee' WHERE id = v_tx.offre_id;

  -- Taux de présence de l'acheteur
  UPDATE users SET nb_annulations = COALESCE(nb_annulations, 0) + 1
  WHERE  id = v_tx.acheteur_id;
END;
$$;

-- ─── 6. cloturer_annonce : ajustement (le stock est déjà réservé) ─────
-- À la clôture, on n'enlève plus la quantité (déjà déduite à l'acceptation) :
-- on ajuste seulement l'écart entre quantité accordée et quantité réellement
-- pesée, puis on passe l'annonce en 'vendue' si tout est écoulé.

CREATE OR REPLACE FUNCTION cloturer_annonce(p_transaction_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tx       transactions%ROWTYPE;
  v_delta    INTEGER;
  v_restants INTEGER;
  v_actives  INTEGER;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF v_tx.annonce_id IS NULL THEN RETURN; END IF;

  -- Écart pesée réelle vs réservation (positif = on rend du stock)
  v_delta := COALESCE(v_tx.quantite_accordee, 0)
           - COALESCE(v_tx.quantite_reelle_pesee, v_tx.quantite_accordee, 0);

  UPDATE annonces
  SET    nb_sujets_restants = GREATEST(0, nb_sujets_restants + v_delta)
  WHERE  id = v_tx.annonce_id;

  -- Annonce vendue si plus de stock ET plus de transaction en cours
  SELECT nb_sujets_restants INTO v_restants
  FROM   annonces WHERE id = v_tx.annonce_id;

  SELECT COUNT(*) INTO v_actives
  FROM   transactions
  WHERE  annonce_id = v_tx.annonce_id
    AND  id <> p_transaction_id
    AND  statut_transaction NOT IN ('cloture','annulee');

  IF v_restants = 0 AND v_actives = 0 THEN
    UPDATE annonces SET statut = 'vendue' WHERE id = v_tx.annonce_id;
  END IF;
END;
$$;

-- ─── 7. Bucket avatars (photos de profil) ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_lecture"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_update"   ON storage.objects;
CREATE POLICY "avatars_lecture" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- ═══════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════

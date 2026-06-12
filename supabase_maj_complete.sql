-- ═══════════════════════════════════════════════════════════════════
-- KOURTI — MISE À JOUR COMPLÈTE (tout-en-un, ré-exécutable)
-- Regroupe : vente auto des séries + enchères V2 + vente express
-- À coller tel quel dans Supabase > SQL Editor > Run
-- ═══════════════════════════════════════════════════════════════════

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ A. MISE EN VENTE AUTOMATIQUE DES SÉRIES (J+35)                 ║
-- ╚════════════════════════════════════════════════════════════════╝

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
      AND  NOT EXISTS (
        SELECT 1 FROM annonces a
        WHERE a.eleveur_id = bd.eleveur_id AND a.statut = 'active'
      )
  LOOP
    v_age := CURRENT_DATE - b.date_mise_en_place;

    SELECT b.nb_sujets_initial - COALESCE(SUM(j.mortalite_jour), 0)
    INTO   v_vivants
    FROM   bande_jours j WHERE j.bande_id = b.id;

    IF v_vivants IS NULL THEN v_vivants := b.nb_sujets_initial; END IF;
    IF v_vivants <= 0 THEN CONTINUE; END IF;

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

CREATE INDEX IF NOT EXISTS idx_offres_annonce_statut
  ON offres(annonce_id, statut);

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ B. ENCHÈRES V2 : créneau, réservation, annulation, contre-offre ║
-- ╚════════════════════════════════════════════════════════════════╝

-- B1. Offres : créneau de chargement + contre-offre
ALTER TABLE offres
  ADD COLUMN IF NOT EXISTS date_chargement_prevue TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contre_prix_kg         NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS contre_quantite        INTEGER,
  ADD COLUMN IF NOT EXISTS contre_date            TIMESTAMPTZ;

ALTER TABLE offres DROP CONSTRAINT IF EXISTS offres_statut_check;
ALTER TABLE offres ADD CONSTRAINT offres_statut_check
  CHECK (statut IN ('en_attente','contre_offre','acceptee','refusee','expiree','annulee'));

-- B2. Transactions : annulation + créneau + horodatage clôture
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS date_chargement_prevue TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motif_annulation       TEXT,
  ADD COLUMN IF NOT EXISTS date_annulation        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_cloture           TIMESTAMPTZ;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_statut_transaction_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_statut_transaction_check
  CHECK (statut_transaction IN ('accord','chargement','pesee','cloture','annulee'));

-- B3. Users : profil enrichi + taux de présence
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS phone2          TEXT,
  ADD COLUMN IF NOT EXISTS phone2_whatsapp BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio             TEXT,
  ADD COLUMN IF NOT EXISTS annee_debut     INTEGER,
  ADD COLUMN IF NOT EXISTS nb_annulations  INTEGER DEFAULT 0;

-- B4. Acceptation atomique : réservation du stock, max 3 transactions,
--     les autres offres restent en attente
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

  SELECT COUNT(*) INTO v_en_cours
  FROM   transactions
  WHERE  eleveur_id = v_offre.eleveur_id
    AND  statut_transaction NOT IN ('cloture','annulee');
  IF v_en_cours >= 3 THEN
    RAISE EXCEPTION 'MAX_TRANSACTIONS';
  END IF;

  SELECT nb_sujets_restants INTO v_restants
  FROM   annonces WHERE id = v_offre.annonce_id FOR UPDATE;
  IF v_restants IS NULL OR v_restants <= 0 THEN
    RAISE EXCEPTION 'STOCK_EPUISE';
  END IF;

  v_quantite := LEAST(v_offre.quantite, v_restants);
  v_prix := COALESCE(v_offre.contre_prix_kg, v_offre.prix_kg);
  IF v_offre.contre_quantite IS NOT NULL THEN
    v_quantite := LEAST(v_offre.contre_quantite, v_restants);
  END IF;

  UPDATE annonces
  SET    nb_sujets_restants = nb_sujets_restants - v_quantite
  WHERE  id = v_offre.annonce_id;

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

-- B5. Annulation manuelle par l'éleveur : motif obligatoire conservé,
--     stock restitué, compteur d'absences de l'acheteur incrémenté
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

  UPDATE annonces
  SET    nb_sujets_restants = nb_sujets_restants + COALESCE(v_tx.quantite_accordee, 0)
  WHERE  id = v_tx.annonce_id;

  UPDATE offres SET statut = 'annulee' WHERE id = v_tx.offre_id;

  UPDATE users SET nb_annulations = COALESCE(nb_annulations, 0) + 1
  WHERE  id = v_tx.acheteur_id;
END;
$$;

-- B6. Clôture : le stock est déjà réservé, on ajuste l'écart de pesée
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

  v_delta := COALESCE(v_tx.quantite_accordee, 0)
           - COALESCE(v_tx.quantite_reelle_pesee, v_tx.quantite_accordee, 0);

  UPDATE annonces
  SET    nb_sujets_restants = GREATEST(0, nb_sujets_restants + v_delta)
  WHERE  id = v_tx.annonce_id;

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

-- B7. Bucket des photos de profil
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_lecture"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_update"   ON storage.objects;
CREATE POLICY "avatars_lecture" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ C. VENTE EXPRESS : expirations + acceptation automatique        ║
-- ╚════════════════════════════════════════════════════════════════╝

-- C1. Prix d'acceptation automatique sur l'annonce
ALTER TABLE annonces
  ADD COLUMN IF NOT EXISTS prix_acceptation_auto NUMERIC(6,2);

-- C2. Expiration des offres (24 h) et contre-offres
CREATE OR REPLACE FUNCTION expirer_offres()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE offres
  SET    statut = 'expiree'
  WHERE  statut IN ('en_attente', 'contre_offre')
    AND  expires_at IS NOT NULL
    AND  expires_at < NOW();
END;
$$;

-- C3. Acceptation automatique : seuil atteint + créneau sous 48 h
--     → vente conclue instantanément, même éleveur hors connexion
CREATE OR REPLACE FUNCTION auto_accepter_offre()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seuil NUMERIC;
BEGIN
  IF NEW.statut <> 'en_attente' THEN RETURN NEW; END IF;

  SELECT prix_acceptation_auto INTO v_seuil
  FROM   annonces
  WHERE  id = NEW.annonce_id AND statut = 'active';

  IF v_seuil IS NOT NULL
     AND NEW.prix_kg >= v_seuil
     AND NEW.date_chargement_prevue IS NOT NULL
     AND NEW.date_chargement_prevue <= NOW() + INTERVAL '48 hours'
     AND NEW.date_chargement_prevue > NOW()
  THEN
    BEGIN
      PERFORM accepter_offre(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- max transactions / stock épuisé → l'offre reste en attente
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_accepter_offre ON offres;
CREATE TRIGGER trg_auto_accepter_offre
  AFTER INSERT OR UPDATE OF prix_kg, statut ON offres
  FOR EACH ROW EXECUTE FUNCTION auto_accepter_offre();

-- ═══════════════════════════════════════════════════════════════════
-- FIN — Vérification rapide : ce SELECT doit retourner 5 fonctions
-- ═══════════════════════════════════════════════════════════════════
SELECT proname FROM pg_proc
WHERE proname IN ('publier_bandes_auto','accepter_offre','annuler_transaction',
                  'expirer_offres','auto_accepter_offre');

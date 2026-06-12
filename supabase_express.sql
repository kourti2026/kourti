-- ═══════════════════════════════════════════════════════════════════
-- KOURTI — Vente express : expirations automatiques + prix
-- d'acceptation automatique (la transaction se conclut sans connexion)
-- À exécuter dans Supabase > SQL Editor (après supabase_encheres_v2.sql)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Prix d'acceptation automatique sur l'annonce ─────────────────
-- L'éleveur fixe un seuil : toute offre >= seuil avec un créneau de
-- chargement sous 48 h est acceptée instantanément par le système.
ALTER TABLE annonces
  ADD COLUMN IF NOT EXISTS prix_acceptation_auto NUMERIC(6,2);

-- ─── 2. Expiration automatique des offres et contre-offres ───────────
-- offres.expires_at existe déjà (défaut NOW() + 24 h à l'insertion).
-- Cette fonction balaie les offres mortes ; elle est appelée par
-- l'application au chargement des listes, et peut aussi être planifiée.

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

-- ─── 3. Acceptation automatique (trigger) ─────────────────────────────
-- Dès qu'une offre arrive (ou est modifiée à la hausse) :
--   seuil atteint + créneau sous 48 h → accepter_offre() est appelée.
-- Les garde-fous d'accepter_offre s'appliquent (max 3 transactions,
-- stock restant) : en cas de blocage, l'offre reste simplement en attente.

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
      -- max transactions / stock épuisé → l'offre reste en attente
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_accepter_offre ON offres;
CREATE TRIGGER trg_auto_accepter_offre
  AFTER INSERT OR UPDATE OF prix_kg, statut ON offres
  FOR EACH ROW EXECUTE FUNCTION auto_accepter_offre();

-- ─── 4. Planification quotidienne optionnelle (si pg_cron actif) ──────
-- SELECT cron.schedule('expirer-offres', '*/30 * * * *', 'SELECT expirer_offres()');

-- ═══════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════

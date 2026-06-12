-- ═══════════════════════════════════════════════════════════
-- KOURTI — Suivi de bande V2
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. TABLE bandes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bandes (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  eleveur_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Données saisies au jour 1
  date_mise_en_place        DATE NOT NULL,
  nb_sujets_initial         INTEGER NOT NULL,
  souche                    TEXT NOT NULL DEFAULT 'Cobb', -- Cobb, Ross, Arbor Acres, Hubbard

  -- Publication automatique
  publication_auto_activee  BOOLEAN NOT NULL DEFAULT true,
  delai_publication_jours   INTEGER NOT NULL DEFAULT 35,   -- 35, 38, 40 ou 42
  date_publication_auto     DATE GENERATED ALWAYS AS (date_mise_en_place + delai_publication_jours) STORED,

  -- Statut de la bande
  -- en_cours / publiee / terminee / abandonnee
  statut                    TEXT NOT NULL DEFAULT 'en_cours',

  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bandes_eleveur ON bandes(eleveur_id);
CREATE INDEX IF NOT EXISTS idx_bandes_statut  ON bandes(statut);

-- ─── 2. TABLE bande_updates ─────────────────────────────────
CREATE TABLE IF NOT EXISTS bande_updates (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bande_id            UUID NOT NULL REFERENCES bandes(id) ON DELETE CASCADE,

  semaine             INTEGER NOT NULL,          -- numéro de semaine (1, 2, 3…)
  poids_moyen         NUMERIC(4,2),              -- kg
  mortalite_semaine   INTEGER DEFAULT 0,
  nb_sujets_restants  INTEGER,

  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bande_id, semaine)                      -- 1 update max par semaine par bande
);

CREATE INDEX IF NOT EXISTS idx_bande_updates_bande ON bande_updates(bande_id);

-- ─── 3. MISE À JOUR TABLE annonces ──────────────────────────
-- Ajouter les colonnes manquantes si elles n'existent pas

ALTER TABLE annonces
  ADD COLUMN IF NOT EXISTS bande_id       UUID REFERENCES bandes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'manuelle',  -- 'auto' | 'manuelle'
  ADD COLUMN IF NOT EXISTS disponibilite  TEXT DEFAULT 'maintenant', -- 'maintenant' | 'sous_3j' | 'sous_2semaines'
  ADD COLUMN IF NOT EXISTS note_libre     TEXT,                      -- max 100 caractères
  ADD COLUMN IF NOT EXISTS boosted        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMPTZ;               -- expiration annonce (21 jours)

-- Index
CREATE INDEX IF NOT EXISTS idx_annonces_bande    ON annonces(bande_id);
CREATE INDEX IF NOT EXISTS idx_annonces_boosted  ON annonces(boosted) WHERE boosted = true;

-- ─── 4. MISE À JOUR TABLE users (badges V2) ─────────────────
-- Recalculer les badges selon les nouveaux seuils V2
-- Nouveau: 0 tx | Actif: 1-4 | Confirmé: 5-14 + note>4 | Fiable: 15-49 + note>4.5 | Référence: 50+ + note>4.8

UPDATE users
SET badge = CASE
  WHEN nb_transactions >= 50 AND note_moyenne > 4.8 THEN 'reference'
  WHEN nb_transactions >= 15 AND note_moyenne > 4.5 THEN 'fiable'
  WHEN nb_transactions >= 5  AND note_moyenne > 4.0 THEN 'confirme'
  WHEN nb_transactions >= 1                          THEN 'actif'
  ELSE 'nouveau'
END;

-- ─── 5. RLS (Row Level Security) ────────────────────────────

ALTER TABLE bandes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bande_updates ENABLE ROW LEVEL SECURITY;

-- bandes : éleveur voit et modifie uniquement les siennes
CREATE POLICY "eleveur_own_bandes" ON bandes
  FOR ALL USING (auth.uid()::text = eleveur_id::text);

-- bande_updates : éleveur voit et modifie ses updates
CREATE POLICY "eleveur_own_updates" ON bande_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bandes b WHERE b.id = bande_id AND b.eleveur_id::text = auth.uid()::text
    )
  );

-- ─── 6. FONCTION auto-publication (optionnel, cron Supabase) ─
-- À déclencher chaque jour via pg_cron ou Supabase Edge Functions
-- Publie automatiquement les bandes dont date_publication_auto = today

CREATE OR REPLACE FUNCTION publier_bandes_auto()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO annonces (
    eleveur_id, bande_id, wilaya, commune,
    nb_sujets_restants, poids_moyen, statut, source, disponibilite, expires_at
  )
  SELECT
    b.eleveur_id,
    b.id,
    u.wilaya,
    u.commune,
    -- Prend le dernier nb_sujets_restants mis à jour, sinon nb_sujets_initial
    COALESCE(
      (SELECT bu.nb_sujets_restants FROM bande_updates bu
       WHERE bu.bande_id = b.id ORDER BY bu.semaine DESC LIMIT 1),
      b.nb_sujets_initial
    ),
    -- Dernier poids moyen, sinon NULL
    (SELECT bu.poids_moyen FROM bande_updates bu
     WHERE bu.bande_id = b.id ORDER BY bu.semaine DESC LIMIT 1),
    'active',
    'auto',
    'maintenant',
    NOW() + INTERVAL '21 days'
  FROM bandes b
  JOIN users u ON u.id = b.eleveur_id
  WHERE b.statut = 'en_cours'
    AND b.publication_auto_activee = true
    AND b.date_publication_auto = CURRENT_DATE
    -- Ne pas créer si une annonce active existe déjà pour cette bande
    AND NOT EXISTS (
      SELECT 1 FROM annonces a
      WHERE a.bande_id = b.id AND a.statut = 'active'
    );

  -- Passer la bande en statut 'publiee'
  UPDATE bandes
  SET statut = 'publiee'
  WHERE statut = 'en_cours'
    AND publication_auto_activee = true
    AND date_publication_auto = CURRENT_DATE;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════

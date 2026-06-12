-- ============================================================
-- KOURTI — كورتي
-- Script SQL — À coller dans Supabase SQL Editor
-- ============================================================

-- TABLE USERS
CREATE TABLE IF NOT EXISTS users (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone                     TEXT UNIQUE NOT NULL,
  role                      TEXT CHECK (role IN ('eleveur','acheteur','both')),
  prenom                    TEXT,
  nom                       TEXT,
  wilaya                    TEXT,
  commune                   TEXT,
  langue                    TEXT DEFAULT 'ar',
  badge                     TEXT DEFAULT 'nouveau',
  nb_transactions           INTEGER DEFAULT 0,
  note_moyenne              NUMERIC(3,2) DEFAULT 0,
  nb_recommandations_recues INTEGER DEFAULT 0,
  disclaimer_accepte        BOOLEAN DEFAULT FALSE,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE ANNONCES
CREATE TABLE IF NOT EXISTS annonces (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  eleveur_id           UUID REFERENCES users(id),
  wilaya               TEXT NOT NULL,
  commune              TEXT NOT NULL,
  nb_sujets_initial    INTEGER NOT NULL,
  nb_sujets_restants   INTEGER NOT NULL,
  poids_moyen          NUMERIC(4,1) NOT NULL,
  souche               TEXT,
  age_initial_sujets   INTEGER NOT NULL,
  date_publication     TIMESTAMPTZ DEFAULT NOW(),
  photos               TEXT[],
  note_libre           TEXT,
  statut               TEXT DEFAULT 'active'
                       CHECK (statut IN ('active','vendue','cloturee_65j','suspendue')),
  gps_floue_lat        NUMERIC(10,6),
  gps_floue_lng        NUMERIC(10,6),
  gps_precise_lat      NUMERIC(10,6),
  gps_precise_lng      NUMERIC(10,6),
  boosted              BOOLEAN DEFAULT FALSE,
  boost_expires_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '21 days')
);

-- TABLE OFFRES
CREATE TABLE IF NOT EXISTS offres (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annonce_id              UUID REFERENCES annonces(id),
  acheteur_id             UUID REFERENCES users(id),
  eleveur_id              UUID REFERENCES users(id),
  quantite                INTEGER NOT NULL,
  prix_kg                 NUMERIC(6,2) NOT NULL,
  message                 TEXT,
  type_paiement           TEXT CHECK (type_paiement IN ('cash','differe')),
  date_paiement_convenue  DATE,
  statut                  TEXT DEFAULT 'en_attente'
                          CHECK (statut IN ('en_attente','acceptee','refusee','expiree')),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  expires_at              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- TABLE TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offre_id                    UUID REFERENCES offres(id),
  annonce_id                  UUID REFERENCES annonces(id),
  eleveur_id                  UUID REFERENCES users(id),
  acheteur_id                 UUID REFERENCES users(id),
  quantite_accordee           INTEGER,
  quantite_reelle_pesee       INTEGER,
  poids_total_kg_pesee        NUMERIC(10,2),
  prix_kg_reel                NUMERIC(6,2),
  montant_total_reel          NUMERIC(14,2),
  date_chargement             TIMESTAMPTZ,
  statut_paiement             TEXT DEFAULT 'en_attente'
                              CHECK (statut_paiement IN
                                ('en_attente','paye','retard','litige_non_paye')),
  date_verification_paiement  DATE,
  note_eleveur                INTEGER CHECK (note_eleveur BETWEEN 1 AND 5),
  note_acheteur               INTEGER CHECK (note_acheteur BETWEEN 1 AND 5),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE PRIX MARCHE
CREATE TABLE IF NOT EXISTS prix_marche (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya           TEXT NOT NULL,
  prix_min         NUMERIC(6,2),
  prix_max         NUMERIC(6,2),
  prix_moyen       NUMERIC(6,2),
  nb_transactions  INTEGER DEFAULT 0,
  fiabilite        TEXT DEFAULT 'estimation'
                   CHECK (fiabilite IN ('confirme','estimation')),
  date             DATE DEFAULT CURRENT_DATE,
  source           TEXT CHECK (source IN ('pesee_app','declaration','terrain')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE RECOMMANDATIONS
CREATE TABLE IF NOT EXISTS recommandations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  eleveur_id     UUID REFERENCES users(id),
  acheteur_id    UUID REFERENCES users(id),
  transaction_id UUID REFERENCES transactions(id),
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(eleveur_id, acheteur_id)
);

-- TABLE SIGNALEMENTS
CREATE TABLE IF NOT EXISTS signalements (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signaleur_id   UUID REFERENCES users(id),
  signale_id     UUID REFERENCES users(id),
  transaction_id UUID REFERENCES transactions(id),
  motif          TEXT,
  statut         TEXT DEFAULT 'ouvert'
                 CHECK (statut IN ('ouvert','traite','ferme')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Sécurité de base
-- ============================================================

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE annonces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE offres        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prix_marche   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommandations ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements  ENABLE ROW LEVEL SECURITY;

-- Lecture publique des annonces actives
CREATE POLICY "annonces_lecture_publique"
  ON annonces FOR SELECT
  USING (statut = 'active');

-- Lecture publique du cours du marché
CREATE POLICY "prix_lecture_publique"
  ON prix_marche FOR SELECT
  USING (TRUE);

-- Lecture publique des profils (infos publiques seulement)
CREATE POLICY "users_lecture_publique"
  ON users FOR SELECT
  USING (TRUE);

-- Écriture libre (à affiner avec l'auth Firebase en phase 2)
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "users_update" ON users FOR UPDATE USING (TRUE);
CREATE POLICY "annonces_insert" ON annonces FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "annonces_update" ON annonces FOR UPDATE USING (TRUE);
CREATE POLICY "offres_all"   ON offres   FOR ALL USING (TRUE);
CREATE POLICY "transactions_all" ON transactions FOR ALL USING (TRUE);
CREATE POLICY "recommandations_all" ON recommandations FOR ALL USING (TRUE);
CREATE POLICY "signalements_all" ON signalements FOR ALL USING (TRUE);

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================

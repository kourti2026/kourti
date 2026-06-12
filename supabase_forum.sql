-- ═══════════════════════════════════════════════════════════════
-- KOURTI — Module Forum communautaire
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS forum_posts (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auteur_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contenu        TEXT NOT NULL CHECK (char_length(contenu) <= 500),
  wilaya_auteur  TEXT,               -- copie au moment de la publication
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_wilaya  ON forum_posts(wilaya_auteur);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout utilisateur connecté peut lire)
CREATE POLICY "forum_read"   ON forum_posts FOR SELECT USING (TRUE);
-- N'importe qui peut publier
CREATE POLICY "forum_insert" ON forum_posts FOR INSERT WITH CHECK (TRUE);
-- Seul l'auteur peut supprimer son propre post (optionnel)
CREATE POLICY "forum_delete" ON forum_posts FOR DELETE USING (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════

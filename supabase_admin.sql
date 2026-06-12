-- ============================================================
-- KOURTI — Interface Admin (rôles admin / assistant)
-- À coller dans Supabase SQL Editor
-- ============================================================

-- 1. Colonne admin_role dans users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_role TEXT
  CHECK (admin_role IN ('admin', 'assistant'))
  DEFAULT NULL;

-- 2. Colonne suspendu dans users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspendu BOOLEAN DEFAULT FALSE;

-- 3. Les admins/assistants peuvent lire tous les users
DROP POLICY IF EXISTS "admin_read_all_users" ON users;
CREATE POLICY "admin_read_all_users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
    OR auth.uid()::text = phone
  );

-- 4. Les admins/assistants peuvent modifier les users
DROP POLICY IF EXISTS "admin_update_users" ON users;
CREATE POLICY "admin_update_users"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
  );

-- 5. Accès admin aux annonces (lecture + modération)
DROP POLICY IF EXISTS "admin_read_all_annonces" ON annonces;
CREATE POLICY "admin_read_all_annonces"
  ON annonces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
  );

DROP POLICY IF EXISTS "admin_update_annonces" ON annonces;
CREATE POLICY "admin_update_annonces"
  ON annonces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
  );

-- 6. Accès admin aux transactions
DROP POLICY IF EXISTS "admin_read_all_transactions" ON transactions;
CREATE POLICY "admin_read_all_transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
  );

-- 7. Accès admin complet aux prix_marche (ajout, modif, suppression)
DROP POLICY IF EXISTS "admin_manage_prix_marche" ON prix_marche;
CREATE POLICY "admin_manage_prix_marche"
  ON prix_marche FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = auth.uid()::text
        AND u.admin_role IN ('admin', 'assistant')
    )
  );

-- ============================================================
-- ÉTAPE FINALE : promouvoir ton compte en admin principal
-- (remplace par TON numéro tel qu'enregistré dans users)
-- ============================================================
-- UPDATE users SET admin_role = 'admin' WHERE phone = '+213XXXXXXXXX';

-- Vérification :
-- SELECT phone, prenom, nom, admin_role FROM users WHERE admin_role IS NOT NULL;

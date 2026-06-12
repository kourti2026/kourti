-- ============================================================
-- KOURTI — Storage policies pour lots-photos
-- Coller en entier dans Supabase SQL Editor → Run
-- ============================================================

-- 1. Crée le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('lots-photos', 'lots-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Supprime les anciennes policies si elles existent
DROP POLICY IF EXISTS "allow_upload_lots" ON storage.objects;
DROP POLICY IF EXISTS "allow_read_lots"   ON storage.objects;
DROP POLICY IF EXISTS "allow_update_lots" ON storage.objects;
DROP POLICY IF EXISTS "allow_delete_lots" ON storage.objects;

-- 3. Recrée les policies proprement
CREATE POLICY "allow_read_lots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lots-photos');

CREATE POLICY "allow_upload_lots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lots-photos');

CREATE POLICY "allow_update_lots"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lots-photos');

CREATE POLICY "allow_delete_lots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lots-photos');

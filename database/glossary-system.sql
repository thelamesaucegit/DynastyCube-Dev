-- =============================================================================
-- GLOSSARY SYSTEM SCHEMA
-- =============================================================================
-- Table for glossary terms and definitions (markdown supported).
-- Publicly readable, admin-only write access.
-- =============================================================================

-- Drop existing objects if re-running
DROP TABLE IF EXISTS glossary_items CASCADE;

-- 1. Glossary Items
-- Each item has a term (title) and a markdown definition
CREATE TABLE glossary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_glossary_items_term ON glossary_items(term);
CREATE INDEX idx_glossary_items_created_at ON glossary_items(created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
-- Reuses handle_updated_at() if it already exists, otherwise creates it
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_glossary_updated_at
  BEFORE UPDATE ON glossary_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE glossary_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read glossary items
CREATE POLICY "glossary_items_select_public" ON glossary_items
  FOR SELECT USING (true);

-- Only admins can insert
CREATE POLICY "glossary_items_insert_admin" ON glossary_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can update
CREATE POLICY "glossary_items_update_admin" ON glossary_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can delete
CREATE POLICY "glossary_items_delete_admin" ON glossary_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

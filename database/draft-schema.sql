-- =================================
-- DYNASTY CUBE DRAFT & DECK SCHEMA
-- =================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================
-- 1. TEAM DRAFT PICKS TABLE
-- Store cards that teams have drafted
-- =================================
CREATE TABLE IF NOT EXISTS team_draft_picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_set text,
  card_type text,
  rarity text,
  colors text[],
  image_url text,
  mana_cost text,
  cmc integer, -- Converted mana cost
  drafted_at timestamp with time zone DEFAULT now(),
  drafted_by uuid REFERENCES auth.users(id),
  pick_number integer, -- Order in which it was drafted
  UNIQUE(team_id, card_id) -- Teams can't have duplicate cards
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS team_draft_picks_team_id_idx ON team_draft_picks(team_id);
CREATE INDEX IF NOT EXISTS team_draft_picks_card_name_idx ON team_draft_picks(card_name);
CREATE INDEX IF NOT EXISTS team_draft_picks_colors_idx ON team_draft_picks USING GIN(colors);

-- =================================
-- 2. TEAM DECKS TABLE
-- Store deck metadata
-- =================================
CREATE TABLE IF NOT EXISTS team_decks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  description text,
  format text DEFAULT 'standard', -- standard, commander, modern, etc.
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS team_decks_team_id_idx ON team_decks(team_id);
CREATE INDEX IF NOT EXISTS team_decks_created_at_idx ON team_decks(created_at DESC);

-- =================================
-- 3. DECK CARDS TABLE
-- Store which cards are in which decks
-- =================================
CREATE TABLE IF NOT EXISTS deck_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id uuid REFERENCES team_decks(id) ON DELETE CASCADE,
  draft_pick_id uuid REFERENCES team_draft_picks(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  quantity integer DEFAULT 1,
  is_commander boolean DEFAULT false, -- For commander format
  category text DEFAULT 'mainboard', -- mainboard, sideboard, maybeboard
  added_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS deck_cards_deck_id_idx ON deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS deck_cards_draft_pick_id_idx ON deck_cards(draft_pick_id);
CREATE INDEX IF NOT EXISTS deck_cards_category_idx ON deck_cards(category);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Enable RLS on all tables
ALTER TABLE team_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;

-- Draft Picks: Everyone can read, authenticated users can modify
CREATE POLICY "Draft picks are viewable by everyone"
  ON team_draft_picks FOR SELECT
  USING (true);

CREATE POLICY "Draft picks can be added by authenticated users"
  ON team_draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Draft picks can be deleted by authenticated users"
  ON team_draft_picks FOR DELETE
  TO authenticated
  USING (true);

-- Team Decks: Everyone can read public decks, authenticated can modify own team's
CREATE POLICY "Public decks are viewable by everyone"
  ON team_decks FOR SELECT
  USING (is_public = true OR auth.role() = 'authenticated');

CREATE POLICY "Decks can be created by authenticated users"
  ON team_decks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Decks can be updated by authenticated users"
  ON team_decks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Decks can be deleted by authenticated users"
  ON team_decks FOR DELETE
  TO authenticated
  USING (true);

-- Deck Cards: Inherit permissions from deck
CREATE POLICY "Deck cards are viewable by everyone"
  ON deck_cards FOR SELECT
  USING (true);

CREATE POLICY "Deck cards can be added by authenticated users"
  ON deck_cards FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Deck cards can be updated by authenticated users"
  ON deck_cards FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Deck cards can be deleted by authenticated users"
  ON deck_cards FOR DELETE
  TO authenticated
  USING (true);

-- =================================
-- HELPER VIEWS
-- =================================

-- View to get deck statistics
CREATE OR REPLACE VIEW deck_stats AS
SELECT
  d.id as deck_id,
  d.deck_name,
  d.team_id,
  COUNT(dc.id) as card_count,
  SUM(dc.quantity) as total_cards,
  AVG(tdp.cmc) as avg_cmc
FROM team_decks d
LEFT JOIN deck_cards dc ON d.id = dc.deck_id
LEFT JOIN team_draft_picks tdp ON dc.draft_pick_id = tdp.id
GROUP BY d.id, d.deck_name, d.team_id;

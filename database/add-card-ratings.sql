-- =================================
-- ADD CARD RATING COLUMNS
-- Adds power level indicators to card tables
-- =================================

-- Add rating columns to card_pools table
ALTER TABLE card_pools
ADD COLUMN IF NOT EXISTS edhrec_rank integer,
ADD COLUMN IF NOT EXISTS cubecobra_elo integer,
ADD COLUMN IF NOT EXISTS rating_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS scryfall_id uuid;

-- Add rating columns to team_draft_picks table
ALTER TABLE team_draft_picks
ADD COLUMN IF NOT EXISTS edhrec_rank integer,
ADD COLUMN IF NOT EXISTS cubecobra_elo integer,
ADD COLUMN IF NOT EXISTS rating_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS scryfall_id uuid;

-- Create indexes for rating-based queries
CREATE INDEX IF NOT EXISTS card_pools_edhrec_rank_idx ON card_pools(edhrec_rank);
CREATE INDEX IF NOT EXISTS card_pools_cubecobra_elo_idx ON card_pools(cubecobra_elo);
CREATE INDEX IF NOT EXISTS card_pools_scryfall_id_idx ON card_pools(scryfall_id);

CREATE INDEX IF NOT EXISTS team_draft_picks_edhrec_rank_idx ON team_draft_picks(edhrec_rank);
CREATE INDEX IF NOT EXISTS team_draft_picks_cubecobra_elo_idx ON team_draft_picks(cubecobra_elo);
CREATE INDEX IF NOT EXISTS team_draft_picks_scryfall_id_idx ON team_draft_picks(scryfall_id);

-- =================================
-- COMMENTS
-- =================================

COMMENT ON COLUMN card_pools.edhrec_rank IS 'Card popularity rank from EDHREC (lower is more popular)';
COMMENT ON COLUMN card_pools.cubecobra_elo IS 'Card power rating from CubeCobra (higher is stronger)';
COMMENT ON COLUMN card_pools.rating_updated_at IS 'When rating data was last fetched';
COMMENT ON COLUMN card_pools.scryfall_id IS 'Unique Scryfall card identifier for API lookups';

COMMENT ON COLUMN team_draft_picks.edhrec_rank IS 'Card popularity rank from EDHREC (lower is more popular)';
COMMENT ON COLUMN team_draft_picks.cubecobra_elo IS 'Card power rating from CubeCobra (higher is stronger)';
COMMENT ON COLUMN team_draft_picks.rating_updated_at IS 'When rating data was last fetched';
COMMENT ON COLUMN team_draft_picks.scryfall_id IS 'Unique Scryfall card identifier for API lookups';

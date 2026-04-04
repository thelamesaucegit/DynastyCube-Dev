-- =================================
-- ADD CMC AND MANA COST TO CARD POOLS
-- =================================

-- Add mana_cost and cmc columns to card_pools
ALTER TABLE card_pools
ADD COLUMN IF NOT EXISTS mana_cost text,
ADD COLUMN IF NOT EXISTS cmc integer DEFAULT 0;

-- Add index for CMC queries
CREATE INDEX IF NOT EXISTS card_pools_cmc_idx ON card_pools(cmc);

-- Add comments
COMMENT ON COLUMN card_pools.mana_cost IS 'Mana cost string (e.g., "{2}{U}{B}")';
COMMENT ON COLUMN card_pools.cmc IS 'Converted mana cost (total mana value)';

-- Ensure team_draft_picks also has these fields (should already exist but let's be sure)
ALTER TABLE team_draft_picks
ADD COLUMN IF NOT EXISTS mana_cost text,
ADD COLUMN IF NOT EXISTS cmc integer DEFAULT 0;

COMMENT ON COLUMN team_draft_picks.mana_cost IS 'Mana cost string (e.g., "{2}{U}{B}")';
COMMENT ON COLUMN team_draft_picks.cmc IS 'Converted mana cost (total mana value)';

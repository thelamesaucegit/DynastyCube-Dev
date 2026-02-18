-- database/draft-order-system.sql
-- Automated Draft Order System
-- Determines pick order based on previous season's regular season record.
-- Worst record picks first. Ties broken by random lottery number (lowest wins).

-- ============================================================================
-- DRAFT ORDER TABLE
-- Stores the calculated draft order for each season
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.draft_order (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  pick_position integer NOT NULL,                    -- 1 = first pick (worst record)
  previous_season_wins integer DEFAULT 0,            -- W from prior season
  previous_season_losses integer DEFAULT 0,          -- L from prior season
  previous_season_win_pct numeric(5,2) DEFAULT 0,    -- Win % from prior season
  lottery_number integer NOT NULL,                   -- Random tiebreaker (1 to max_teams)
  is_lottery_winner boolean DEFAULT false,            -- True if tiebreaker determined position
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_draft_order_team UNIQUE (season_id, team_id),
  CONSTRAINT unique_draft_order_position UNIQUE (season_id, pick_position),
  CONSTRAINT unique_draft_order_lottery UNIQUE (season_id, lottery_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draft_order_season ON public.draft_order(season_id);
CREATE INDEX IF NOT EXISTS idx_draft_order_team ON public.draft_order(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_order_position ON public.draft_order(season_id, pick_position);

-- ============================================================================
-- DRAFT SETTINGS TABLE
-- Admin-configurable settings for the draft system
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.draft_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Seed default settings
INSERT INTO public.draft_settings (setting_key, setting_value)
VALUES ('max_teams', '8')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE public.draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_settings ENABLE ROW LEVEL SECURITY;

-- Draft Order: All authenticated users can read
CREATE POLICY "draft_order_select_authenticated"
  ON public.draft_order FOR SELECT
  TO authenticated
  USING (true);

-- Draft Order: Admins can insert
CREATE POLICY "draft_order_insert_admin"
  ON public.draft_order FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Draft Order: Admins can update
CREATE POLICY "draft_order_update_admin"
  ON public.draft_order FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Draft Order: Admins can delete
CREATE POLICY "draft_order_delete_admin"
  ON public.draft_order FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Draft Settings: All authenticated users can read
CREATE POLICY "draft_settings_select_authenticated"
  ON public.draft_settings FOR SELECT
  TO authenticated
  USING (true);

-- Draft Settings: Admins can insert
CREATE POLICY "draft_settings_insert_admin"
  ON public.draft_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Draft Settings: Admins can update
CREATE POLICY "draft_settings_update_admin"
  ON public.draft_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Draft Settings: Admins can delete
CREATE POLICY "draft_settings_delete_admin"
  ON public.draft_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Grant access to anon for public read if needed
GRANT SELECT ON public.draft_order TO anon;
GRANT SELECT ON public.draft_order TO authenticated;
GRANT ALL ON public.draft_order TO authenticated;

GRANT SELECT ON public.draft_settings TO anon;
GRANT SELECT ON public.draft_settings TO authenticated;
GRANT ALL ON public.draft_settings TO authenticated;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_draft_order_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER draft_order_updated_at
  BEFORE UPDATE ON public.draft_order
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_draft_order_updated_at();

CREATE TRIGGER draft_settings_updated_at
  BEFORE UPDATE ON public.draft_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_draft_order_updated_at();

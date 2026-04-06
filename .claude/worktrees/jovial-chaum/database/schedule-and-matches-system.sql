-- =================================
-- DYNASTY CUBE SCHEDULE & MATCHES SYSTEM
-- =================================
-- This schema supports:
-- - Weekly schedules with deadlines
-- - Match scheduling between teams
-- - Best of 3 match recording
-- - Deck list submissions
-- - Playoff and championship tracking
-- =================================

-- =================================
-- SCHEDULE WEEKS TABLE
-- Tracks each week of the season
-- =================================
CREATE TABLE IF NOT EXISTS public.schedule_weeks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  deck_submission_deadline timestamp with time zone NOT NULL,
  match_completion_deadline timestamp with time zone NOT NULL,
  is_playoff_week boolean DEFAULT false,
  is_championship_week boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_season_week UNIQUE (season_id, week_number),
  CONSTRAINT valid_week_dates CHECK (end_date > start_date),
  CONSTRAINT valid_deck_deadline CHECK (deck_submission_deadline <= end_date)
);

-- =================================
-- MATCHES TABLE
-- Tracks scheduled matches between teams
-- =================================
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
  home_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Match settings
  best_of integer DEFAULT 3, -- Best of 3 for regular season, can be different for playoffs

  -- Match status
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

  -- Results
  home_team_wins integer DEFAULT 0,
  away_team_wins integer DEFAULT 0,
  winner_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,

  -- Confirmation tracking
  home_team_confirmed boolean DEFAULT false,
  away_team_confirmed boolean DEFAULT false,
  confirmed_at timestamp with time zone,

  -- Admin notes
  admin_notes text,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,

  CONSTRAINT different_teams CHECK (home_team_id != away_team_id),
  CONSTRAINT valid_wins CHECK (
    home_team_wins >= 0 AND
    away_team_wins >= 0 AND
    home_team_wins <= best_of AND
    away_team_wins <= best_of
  )
);

-- =================================
-- MATCH GAMES TABLE
-- Tracks individual games within a match (Bo3)
-- =================================
CREATE TABLE IF NOT EXISTS public.match_games (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number integer NOT NULL, -- 1, 2, or 3 for Bo3

  -- Game result
  winner_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Submission tracking
  reported_by_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  reported_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_at timestamp with time zone DEFAULT now(),

  -- Confirmation
  confirmed_by_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  confirmed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamp with time zone,
  is_confirmed boolean DEFAULT false,

  -- Optional game details
  duration_minutes integer,
  notes text,

  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_match_game UNIQUE (match_id, game_number),
  CONSTRAINT valid_game_number CHECK (game_number >= 1)
);

-- =================================
-- DECK SUBMISSIONS TABLE
-- Tracks deck list submissions for each week
-- =================================
CREATE TABLE IF NOT EXISTS public.deck_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,

  -- Deck information
  deck_name text,
  deck_list text NOT NULL, -- Card list, one per line or JSON format
  format text, -- e.g., "text", "json", "moxfield_url"

  -- Submission tracking
  submitted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at timestamp with time zone DEFAULT now(),

  -- Confirmation
  confirmed_by_captain boolean DEFAULT false,
  confirmed_at timestamp with time zone,

  -- Version tracking (allow resubmissions before deadline)
  version integer DEFAULT 1,
  is_current boolean DEFAULT true,

  notes text,

  CONSTRAINT unique_current_team_week UNIQUE (team_id, week_id, is_current)
);

-- =================================
-- DEADLINES TABLE
-- Flexible deadline tracking for various types
-- =================================
CREATE TABLE IF NOT EXISTS public.deadlines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,

  -- Deadline details
  deadline_type text NOT NULL CHECK (deadline_type IN (
    'deck_submission',
    'match_completion',
    'trade_window_close',
    'draft_window_close',
    'other'
  )),
  deadline_datetime timestamp with time zone NOT NULL,
  title text NOT NULL,
  description text,

  -- Scope (optional - for team-specific or match-specific deadlines)
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,

  -- Notifications
  notification_sent boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,

  created_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- =================================
-- INDEXES FOR PERFORMANCE
-- =================================
CREATE INDEX IF NOT EXISTS idx_schedule_weeks_season ON public.schedule_weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_schedule_weeks_dates ON public.schedule_weeks(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_matches_week ON public.matches(week_id);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON public.matches(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

CREATE INDEX IF NOT EXISTS idx_match_games_match ON public.match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_match_games_winner ON public.match_games(winner_team_id);

CREATE INDEX IF NOT EXISTS idx_deck_submissions_team_week ON public.deck_submissions(team_id, week_id);
CREATE INDEX IF NOT EXISTS idx_deck_submissions_current ON public.deck_submissions(is_current) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_deadlines_week ON public.deadlines(week_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_datetime ON public.deadlines(deadline_datetime);
CREATE INDEX IF NOT EXISTS idx_deadlines_type ON public.deadlines(deadline_type);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Schedule Weeks: Everyone can view
ALTER TABLE public.schedule_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule weeks are viewable by everyone"
  ON public.schedule_weeks FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage schedule weeks"
  ON public.schedule_weeks FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- Matches: Everyone can view
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone"
  ON public.matches FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage matches"
  ON public.matches FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- Match Games: Everyone can view, teams can submit
ALTER TABLE public.match_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match games are viewable by everyone"
  ON public.match_games FOR SELECT
  USING (true);

CREATE POLICY "Team members can report match games"
  ON public.match_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    )
  );

CREATE POLICY "Team members can update their match games"
  ON public.match_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    )
  );

CREATE POLICY "Admins can manage match games"
  ON public.match_games FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- Deck Submissions: Teams can view their own and submit
ALTER TABLE public.deck_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams can view their own deck submissions"
  ON public.deck_submissions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    ) OR
    (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Team members can submit decks"
  ON public.deck_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    )
  );

CREATE POLICY "Team members can update their deck submissions"
  ON public.deck_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    )
  );

CREATE POLICY "Admins can manage all deck submissions"
  ON public.deck_submissions FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- Deadlines: Everyone can view
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deadlines are viewable by everyone"
  ON public.deadlines FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage deadlines"
  ON public.deadlines FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- =================================
-- TRIGGERS FOR UPDATED_AT
-- =================================

CREATE OR REPLACE FUNCTION public.handle_schedule_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_schedule_week_updated ON public.schedule_weeks;
CREATE TRIGGER on_schedule_week_updated
  BEFORE UPDATE ON public.schedule_weeks
  FOR EACH ROW EXECUTE FUNCTION public.handle_schedule_updated_at();

DROP TRIGGER IF EXISTS on_match_updated ON public.matches;
CREATE TRIGGER on_match_updated
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_schedule_updated_at();

-- =================================
-- TRIGGER TO AUTO-UPDATE MATCH WINS
-- =================================

CREATE OR REPLACE FUNCTION public.update_match_wins()
RETURNS trigger AS $$
DECLARE
  v_home_wins integer;
  v_away_wins integer;
  v_home_team text;
  v_away_team text;
  v_best_of integer;
  v_winner text;
BEGIN
  -- Get match details
  SELECT home_team_id, away_team_id, best_of
  INTO v_home_team, v_away_team, v_best_of
  FROM public.matches
  WHERE id = NEW.match_id;

  -- Count confirmed wins for each team
  SELECT
    COUNT(*) FILTER (WHERE winner_team_id = v_home_team AND is_confirmed = true),
    COUNT(*) FILTER (WHERE winner_team_id = v_away_team AND is_confirmed = true)
  INTO v_home_wins, v_away_wins
  FROM public.match_games
  WHERE match_id = NEW.match_id;

  -- Determine winner if match is decided
  v_winner := NULL;
  IF v_home_wins > v_best_of / 2 THEN
    v_winner := v_home_team;
  ELSIF v_away_wins > v_best_of / 2 THEN
    v_winner := v_away_team;
  END IF;

  -- Update match
  UPDATE public.matches
  SET
    home_team_wins = v_home_wins,
    away_team_wins = v_away_wins,
    winner_team_id = v_winner,
    status = CASE
      WHEN v_winner IS NOT NULL THEN 'completed'
      WHEN v_home_wins > 0 OR v_away_wins > 0 THEN 'in_progress'
      ELSE 'scheduled'
    END,
    completed_at = CASE WHEN v_winner IS NOT NULL AND completed_at IS NULL THEN now() ELSE completed_at END
  WHERE id = NEW.match_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_match_game_result ON public.match_games;
CREATE TRIGGER on_match_game_result
  AFTER INSERT OR UPDATE ON public.match_games
  FOR EACH ROW EXECUTE FUNCTION public.update_match_wins();

-- =================================
-- NOTES & EXAMPLES
-- =================================

-- To create a new week:
-- INSERT INTO public.schedule_weeks (season_id, week_number, start_date, end_date, deck_submission_deadline, match_completion_deadline)
-- VALUES ('season-uuid', 1, '2025-01-20', '2025-01-27', '2025-01-24 23:59:59', '2025-01-27 23:59:59');

-- To schedule a match:
-- INSERT INTO public.matches (week_id, home_team_id, away_team_id, best_of)
-- VALUES ('week-uuid', 'team1-uuid', 'team2-uuid', 3);

-- To submit a match game result:
-- INSERT INTO public.match_games (match_id, game_number, winner_team_id, reported_by_team_id, reported_by_user_id)
-- VALUES ('match-uuid', 1, 'winner-team-uuid', 'reporting-team-uuid', 'user-uuid');

-- To confirm a game result:
-- UPDATE public.match_games
-- SET is_confirmed = true, confirmed_by_team_id = 'other-team-uuid', confirmed_by_user_id = 'user-uuid', confirmed_at = now()
-- WHERE id = 'game-uuid';

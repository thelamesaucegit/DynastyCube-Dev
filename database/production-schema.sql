-- =================================================================================================
-- DYNASTY CUBE - PRODUCTION DATABASE SCHEMA
-- =================================================================================================
-- Version: 1.0
-- Description: Complete production-ready database schema for Dynasty Cube
-- Features:
--   - Comprehensive team and user management
--   - Draft and deck building system
--   - Cubucks economy system
--   - Trading system with messaging
--   - Match scheduling and results tracking
--   - Reports and notifications
--   - Admin news system
--   - Secure Row Level Security (RLS) policies
--   - Performance indexes
--   - Audit logging
-- =================================================================================================

-- =================================================================================================
-- EXTENSIONS
-- =================================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================================================
-- CLEANUP: DROP CONFLICTING OBJECTS FROM PREVIOUS DEPLOYMENTS
-- =================================================================================================
-- This section ensures a clean installation by removing any objects (functions, views)
-- that might conflict with the objects defined in this schema.
-- These may exist from running individual migration files before this unified schema.

-- Drop any existing versions of spend_cubucks_on_draft (may have 6 or 7 parameters)
DROP FUNCTION IF EXISTS spend_cubucks_on_draft(text, integer, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS spend_cubucks_on_draft(text, integer, text, text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.spend_cubucks_on_draft(text, integer, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.spend_cubucks_on_draft(text, integer, text, text, uuid, uuid, uuid);

-- Drop existing views (they will be recreated with current structure)
DROP VIEW IF EXISTS public.team_members_with_roles CASCADE;
DROP VIEW IF EXISTS public.deck_stats CASCADE;
DROP VIEW IF EXISTS public.active_trades_view CASCADE;
DROP VIEW IF EXISTS public.notification_counts_view CASCADE;
DROP VIEW IF EXISTS public.message_counts_view CASCADE;
DROP VIEW IF EXISTS public.pending_reports_view CASCADE;
DROP VIEW IF EXISTS public.current_season_info CASCADE;
DROP VIEW IF EXISTS public.active_polls_view CASCADE;

-- =================================================================================================
-- SECTION 1: CORE TABLES
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1.1 USERS TABLE
-- Extended user profiles beyond auth.users
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  display_name text,
  avatar_url text,
  discord_id text,
  discord_username text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_is_admin_idx ON public.users(is_admin);
CREATE INDEX IF NOT EXISTS users_discord_id_idx ON public.users(discord_id);

COMMENT ON TABLE public.users IS 'Extended user profiles with Discord integration';
COMMENT ON COLUMN public.users.is_admin IS 'Admin flag for elevated permissions';

-- -------------------------------------------------------------------------------------------------
-- 1.2 TEAMS TABLE
-- Core team information
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  motto text NOT NULL,
  cubucks_balance integer DEFAULT 0,
  cubucks_total_earned integer DEFAULT 0,
  cubucks_total_spent integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_name_idx ON public.teams(name);

COMMENT ON TABLE public.teams IS 'Dynasty Cube teams';
COMMENT ON COLUMN public.teams.cubucks_balance IS 'Current available Cubucks for this team';
COMMENT ON COLUMN public.teams.cubucks_total_earned IS 'Total Cubucks earned all-time';
COMMENT ON COLUMN public.teams.cubucks_total_spent IS 'Total Cubucks spent all-time';

-- -------------------------------------------------------------------------------------------------
-- 1.3 TEAM MEMBERS TABLE
-- Links users to teams
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members(team_id);

COMMENT ON TABLE public.team_members IS 'User membership in teams';

-- -------------------------------------------------------------------------------------------------
-- 1.4 TEAM MEMBER ROLES TABLE
-- Role assignments for team members (captain, broker, historian, pilot)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_member_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(team_member_id, role)
);

CREATE INDEX IF NOT EXISTS team_member_roles_team_member_id_idx ON public.team_member_roles(team_member_id);
CREATE INDEX IF NOT EXISTS team_member_roles_role_idx ON public.team_member_roles(role);

COMMENT ON TABLE public.team_member_roles IS 'Role assignments for team members';
COMMENT ON COLUMN public.team_member_roles.role IS 'captain, broker, historian, or pilot';

-- -------------------------------------------------------------------------------------------------
-- 1.5 TEAM ROLE HISTORY TABLE
-- Audit log for role changes
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_role_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  action text NOT NULL CHECK (action IN ('assigned', 'removed')),
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamp with time zone DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS team_role_history_team_member_id_idx ON public.team_role_history(team_member_id);
CREATE INDEX IF NOT EXISTS team_role_history_performed_at_idx ON public.team_role_history(performed_at DESC);

COMMENT ON TABLE public.team_role_history IS 'Audit log for role assignment changes';

-- -------------------------------------------------------------------------------------------------
-- 1.6 USER ROLES TABLE
-- Global user permission roles
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  granted_at timestamp with time zone DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);

COMMENT ON TABLE public.user_roles IS 'Global user permission roles';

-- =================================================================================================
-- SECTION 2: SEASONS & PHASES
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 2.1 SEASONS TABLE
-- Track different seasons/periods
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_number integer NOT NULL UNIQUE,
  season_name text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  cubucks_allocation integer DEFAULT 1000,
  is_active boolean DEFAULT false,
  phase text DEFAULT 'preseason' CHECK (phase IN ('preseason', 'season', 'playoffs', 'postseason')),
  phase_changed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seasons_is_active_idx ON public.seasons(is_active);
CREATE INDEX IF NOT EXISTS seasons_season_number_idx ON public.seasons(season_number);
CREATE INDEX IF NOT EXISTS seasons_phase_idx ON public.seasons(phase);

COMMENT ON TABLE public.seasons IS 'Draft seasons/periods';
COMMENT ON COLUMN public.seasons.cubucks_allocation IS 'Cubucks given to each team at start of season';
COMMENT ON COLUMN public.seasons.phase IS 'Current phase: preseason, season, playoffs, or postseason';

-- -------------------------------------------------------------------------------------------------
-- 2.2 TEAM SEASON STATS TABLE
-- Track team performance per season
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_season_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  starting_cubucks integer DEFAULT 0,
  current_cubucks integer DEFAULT 0,
  cubucks_spent integer DEFAULT 0,
  cards_drafted integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, season_id)
);

CREATE INDEX IF NOT EXISTS team_season_stats_team_id_idx ON public.team_season_stats(team_id);
CREATE INDEX IF NOT EXISTS team_season_stats_season_id_idx ON public.team_season_stats(season_id);

COMMENT ON TABLE public.team_season_stats IS 'Team statistics per season';

-- =================================================================================================
-- SECTION 3: CARD MANAGEMENT
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 3.1 CARD POOLS TABLE
-- Store MTG cards available for draft
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_pools (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_set text,
  card_type text,
  rarity text,
  colors text[],
  image_url text,
  pool_name text DEFAULT 'default',
  cubucks_cost integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS card_pools_pool_name_idx ON public.card_pools(pool_name);
CREATE INDEX IF NOT EXISTS card_pools_card_name_idx ON public.card_pools(card_name);
CREATE INDEX IF NOT EXISTS card_pools_cubucks_cost_idx ON public.card_pools(cubucks_cost);
CREATE INDEX IF NOT EXISTS card_pools_colors_idx ON public.card_pools USING GIN(colors);

COMMENT ON TABLE public.card_pools IS 'MTG cards available for drafting';
COMMENT ON COLUMN public.card_pools.cubucks_cost IS 'Cost in Cubucks to draft this card';

-- -------------------------------------------------------------------------------------------------
-- 3.2 TEAM DRAFT PICKS TABLE
-- Store cards that teams have drafted
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_draft_picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_set text,
  card_type text,
  rarity text,
  colors text[],
  image_url text,
  mana_cost text,
  cmc integer,
  drafted_at timestamp with time zone DEFAULT now(),
  drafted_by uuid REFERENCES auth.users(id),
  pick_number integer,
  UNIQUE(team_id, card_id)
);

CREATE INDEX IF NOT EXISTS team_draft_picks_team_id_idx ON public.team_draft_picks(team_id);
CREATE INDEX IF NOT EXISTS team_draft_picks_card_name_idx ON public.team_draft_picks(card_name);
CREATE INDEX IF NOT EXISTS team_draft_picks_colors_idx ON public.team_draft_picks USING GIN(colors);

COMMENT ON TABLE public.team_draft_picks IS 'Cards drafted by teams';
COMMENT ON COLUMN public.team_draft_picks.cmc IS 'Converted mana cost';

-- =================================================================================================
-- SECTION 4: DECK BUILDING
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 4.1 TEAM DECKS TABLE
-- Store deck metadata
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_decks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  description text,
  format text DEFAULT 'standard',
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS team_decks_team_id_idx ON public.team_decks(team_id);
CREATE INDEX IF NOT EXISTS team_decks_created_at_idx ON public.team_decks(created_at DESC);

COMMENT ON TABLE public.team_decks IS 'Team deck metadata';

-- -------------------------------------------------------------------------------------------------
-- 4.2 DECK CARDS TABLE
-- Store which cards are in which decks
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deck_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id uuid REFERENCES public.team_decks(id) ON DELETE CASCADE,
  draft_pick_id uuid REFERENCES public.team_draft_picks(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  quantity integer DEFAULT 1,
  is_commander boolean DEFAULT false,
  category text DEFAULT 'mainboard' CHECK (category IN ('mainboard', 'sideboard', 'maybeboard')),
  added_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deck_cards_deck_id_idx ON public.deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS deck_cards_draft_pick_id_idx ON public.deck_cards(draft_pick_id);
CREATE INDEX IF NOT EXISTS deck_cards_category_idx ON public.deck_cards(category);

COMMENT ON TABLE public.deck_cards IS 'Cards in team decks';

-- =================================================================================================
-- SECTION 5: CUBUCKS ECONOMY
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 5.1 CUBUCKS TRANSACTIONS TABLE
-- Track all Cubucks movements
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cubucks_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('allocation', 'draft_pick', 'refund', 'adjustment')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  card_id text,
  card_name text,
  draft_pick_id uuid REFERENCES public.team_draft_picks(id) ON DELETE SET NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cubucks_transactions_team_id_idx ON public.cubucks_transactions(team_id);
CREATE INDEX IF NOT EXISTS cubucks_transactions_season_id_idx ON public.cubucks_transactions(season_id);
CREATE INDEX IF NOT EXISTS cubucks_transactions_type_idx ON public.cubucks_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS cubucks_transactions_created_at_idx ON public.cubucks_transactions(created_at DESC);

COMMENT ON TABLE public.cubucks_transactions IS 'Audit log of all Cubucks transactions';
COMMENT ON COLUMN public.cubucks_transactions.transaction_type IS 'Type: allocation, draft_pick, refund, adjustment';
COMMENT ON COLUMN public.cubucks_transactions.amount IS 'Positive for earning, negative for spending';

-- =================================================================================================
-- SECTION 6: TRADING SYSTEM
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 6.1 SYSTEM SETTINGS TABLE
-- Store global settings like trade enabled/disabled
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.system_settings IS 'Global system settings';

-- -------------------------------------------------------------------------------------------------
-- 6.2 TRADES TABLE
-- Core trade proposals
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  to_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  deadline timestamp with time zone NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT different_teams CHECK (from_team_id != to_team_id)
);

CREATE INDEX IF NOT EXISTS trades_from_team_idx ON public.trades(from_team_id);
CREATE INDEX IF NOT EXISTS trades_to_team_idx ON public.trades(to_team_id);
CREATE INDEX IF NOT EXISTS trades_status_idx ON public.trades(status);
CREATE INDEX IF NOT EXISTS trades_deadline_idx ON public.trades(deadline);

COMMENT ON TABLE public.trades IS 'Trade proposals between teams';
COMMENT ON COLUMN public.trades.status IS 'pending, accepted, rejected, cancelled, expired';
COMMENT ON COLUMN public.trades.deadline IS 'When the trade offer expires';

-- -------------------------------------------------------------------------------------------------
-- 6.3 TRADE ITEMS TABLE
-- Items being traded (cards or draft picks)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  offering_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('card', 'draft_pick')),
  draft_pick_id uuid REFERENCES public.team_draft_picks(id) ON DELETE CASCADE,
  card_id text,
  card_name text,
  draft_pick_round integer,
  draft_pick_season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT item_specified CHECK (
    (item_type = 'card' AND draft_pick_id IS NOT NULL) OR
    (item_type = 'draft_pick' AND draft_pick_round IS NOT NULL AND draft_pick_season_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS trade_items_trade_idx ON public.trade_items(trade_id);
CREATE INDEX IF NOT EXISTS trade_items_offering_team_idx ON public.trade_items(offering_team_id);
CREATE INDEX IF NOT EXISTS trade_items_type_idx ON public.trade_items(item_type);

COMMENT ON TABLE public.trade_items IS 'Items (cards or draft picks) being traded';
COMMENT ON COLUMN public.trade_items.item_type IS 'card or draft_pick';

-- -------------------------------------------------------------------------------------------------
-- 6.4 TRADE MESSAGES TABLE
-- Message/negotiation system for trades
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_messages_trade_idx ON public.trade_messages(trade_id);
CREATE INDEX IF NOT EXISTS trade_messages_user_idx ON public.trade_messages(user_id);
CREATE INDEX IF NOT EXISTS trade_messages_created_at_idx ON public.trade_messages(created_at DESC);

COMMENT ON TABLE public.trade_messages IS 'Messages and negotiations for trade proposals';

-- -------------------------------------------------------------------------------------------------
-- 6.5 FUTURE DRAFT PICKS TABLE
-- Track future draft picks that can be traded
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.future_draft_picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  original_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number > 0),
  is_traded boolean DEFAULT false,
  traded_to_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(original_team_id, season_id, round_number)
);

CREATE INDEX IF NOT EXISTS future_draft_picks_team_idx ON public.future_draft_picks(team_id);
CREATE INDEX IF NOT EXISTS future_draft_picks_season_idx ON public.future_draft_picks(season_id);
CREATE INDEX IF NOT EXISTS future_draft_picks_traded_idx ON public.future_draft_picks(is_traded);

COMMENT ON TABLE public.future_draft_picks IS 'Future draft picks that can be traded';
COMMENT ON COLUMN public.future_draft_picks.team_id IS 'Current owner of the pick';
COMMENT ON COLUMN public.future_draft_picks.original_team_id IS 'Original team that had the pick';

-- =================================================================================================
-- SECTION 7: MESSAGING & NOTIFICATIONS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 7.1 MESSAGES TABLE
-- Direct messages between users
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  parent_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

CREATE INDEX IF NOT EXISTS messages_from_user_idx ON public.messages(from_user_id);
CREATE INDEX IF NOT EXISTS messages_to_user_idx ON public.messages(to_user_id);
CREATE INDEX IF NOT EXISTS messages_read_idx ON public.messages(is_read);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_parent_idx ON public.messages(parent_message_id);

COMMENT ON TABLE public.messages IS 'Direct messages between users';
COMMENT ON COLUMN public.messages.parent_message_id IS 'For threaded conversations/replies';

-- -------------------------------------------------------------------------------------------------
-- 7.2 NOTIFICATIONS TABLE
-- Notify users about various events
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'trade_proposal',
    'trade_accepted',
    'trade_rejected',
    'trade_message',
    'trade_expired',
    'report_submitted',
    'new_message',
    'season_phase_change'
  )),
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_trade_idx ON public.notifications(trade_id);

COMMENT ON TABLE public.notifications IS 'User notifications for various events';

-- =================================================================================================
-- SECTION 8: REPORTS SYSTEM
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 8.1 REPORTS TABLE
-- User-submitted reports for bad actors, bugs, and issues
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  report_type text NOT NULL CHECK (report_type IN ('bad_actor', 'bug', 'issue', 'other')),
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'dismissed')),
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_type_idx ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports(status);
CREATE INDEX IF NOT EXISTS reports_severity_idx ON public.reports(severity);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports(created_at DESC);

COMMENT ON TABLE public.reports IS 'User-submitted reports for bad actors, bugs, and issues';
COMMENT ON COLUMN public.reports.report_type IS 'bad_actor, bug, issue, or other';
COMMENT ON COLUMN public.reports.severity IS 'low, medium, high, or critical';
COMMENT ON COLUMN public.reports.status IS 'pending, in_review, resolved, or dismissed';

-- -------------------------------------------------------------------------------------------------
-- 8.2 REPORT ATTACHMENTS TABLE
-- Optional screenshots/files for reports
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_attachments_report_idx ON public.report_attachments(report_id);

COMMENT ON TABLE public.report_attachments IS 'File attachments for reports (screenshots, logs, etc.)';

-- =================================================================================================
-- SECTION 9: SCHEDULE & MATCHES
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 9.1 SCHEDULE WEEKS TABLE
-- Tracks each week of the season
-- -------------------------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_schedule_weeks_season ON public.schedule_weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_schedule_weeks_dates ON public.schedule_weeks(start_date, end_date);

COMMENT ON TABLE public.schedule_weeks IS 'Weekly schedule for each season';

-- -------------------------------------------------------------------------------------------------
-- 9.2 MATCHES TABLE
-- Tracks scheduled matches between teams
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
  home_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  best_of integer DEFAULT 3,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  home_team_wins integer DEFAULT 0,
  away_team_wins integer DEFAULT 0,
  winner_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  home_team_confirmed boolean DEFAULT false,
  away_team_confirmed boolean DEFAULT false,
  confirmed_at timestamp with time zone,
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

CREATE INDEX IF NOT EXISTS idx_matches_week ON public.matches(week_id);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON public.matches(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

COMMENT ON TABLE public.matches IS 'Scheduled matches between teams';

-- -------------------------------------------------------------------------------------------------
-- 9.3 MATCH GAMES TABLE
-- Tracks individual games within a match (Bo3)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_games (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number integer NOT NULL,
  winner_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  reported_by_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  reported_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_at timestamp with time zone DEFAULT now(),
  confirmed_by_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  confirmed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamp with time zone,
  is_confirmed boolean DEFAULT false,
  duration_minutes integer,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_match_game UNIQUE (match_id, game_number),
  CONSTRAINT valid_game_number CHECK (game_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_match_games_match ON public.match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_match_games_winner ON public.match_games(winner_team_id);

COMMENT ON TABLE public.match_games IS 'Individual games within matches';

-- -------------------------------------------------------------------------------------------------
-- 9.4 DECK SUBMISSIONS TABLE
-- Tracks deck list submissions for each week
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deck_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
  deck_name text,
  deck_list text NOT NULL,
  format text,
  submitted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at timestamp with time zone DEFAULT now(),
  confirmed_by_captain boolean DEFAULT false,
  confirmed_at timestamp with time zone,
  version integer DEFAULT 1,
  is_current boolean DEFAULT true,
  notes text,
  CONSTRAINT unique_current_team_week UNIQUE (team_id, week_id, is_current)
);

CREATE INDEX IF NOT EXISTS idx_deck_submissions_team_week ON public.deck_submissions(team_id, week_id);
CREATE INDEX IF NOT EXISTS idx_deck_submissions_current ON public.deck_submissions(is_current) WHERE is_current = true;

COMMENT ON TABLE public.deck_submissions IS 'Weekly deck submissions by teams';

-- -------------------------------------------------------------------------------------------------
-- 9.5 DEADLINES TABLE
-- Flexible deadline tracking for various types
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deadlines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
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
  team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  notification_sent boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deadlines_week ON public.deadlines(week_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_datetime ON public.deadlines(deadline_datetime);
CREATE INDEX IF NOT EXISTS idx_deadlines_type ON public.deadlines(deadline_type);

COMMENT ON TABLE public.deadlines IS 'Flexible deadline tracking system';

-- =================================================================================================
-- SECTION 10: ADMIN NEWS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 10.1 ADMIN NEWS TABLE
-- Store admin news posts
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_news (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_news_author_id ON public.admin_news(author_id);
CREATE INDEX IF NOT EXISTS idx_admin_news_is_published ON public.admin_news(is_published);
CREATE INDEX IF NOT EXISTS idx_admin_news_created_at ON public.admin_news(created_at DESC);

COMMENT ON TABLE public.admin_news IS 'Admin news posts for the home page';

-- =================================================================================================
-- SECTION 11: HELPER FUNCTIONS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 11.1 ADMIN CHECK FUNCTION
-- Returns true if the current user is an admin
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT is_admin
    FROM public.users
    WHERE id = auth.uid()
  ) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin() IS 'Check if current user is an admin';

-- -------------------------------------------------------------------------------------------------
-- 11.2 GET ACTIVE SEASON FUNCTION
-- Returns the UUID of the active season
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_season()
RETURNS uuid AS $$
DECLARE
  active_season_id uuid;
BEGIN
  SELECT id INTO active_season_id
  FROM public.seasons
  WHERE is_active = true
  LIMIT 1;

  RETURN active_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_active_season() IS 'Get the currently active season';

-- -------------------------------------------------------------------------------------------------
-- 11.3 ALLOCATE CUBUCKS FUNCTION
-- Allocate Cubucks to a team
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_cubucks_to_team(
  p_team_id text,
  p_amount integer,
  p_season_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_new_balance integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(p_season_id, public.get_active_season());

  UPDATE public.teams
  SET
    cubucks_balance = cubucks_balance + p_amount,
    cubucks_total_earned = cubucks_total_earned + p_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  INSERT INTO public.cubucks_transactions (
    team_id,
    season_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_team_id,
    v_season_id,
    'allocation',
    p_amount,
    v_new_balance,
    COALESCE(p_description, 'Cubucks allocation'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.allocate_cubucks_to_team IS 'Allocate Cubucks to a team';

-- -------------------------------------------------------------------------------------------------
-- 11.4 SPEND CUBUCKS FUNCTION
-- Spend Cubucks on a draft pick
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_cubucks_on_draft(
  p_team_id text,
  p_amount integer,
  p_card_id text,
  p_card_name text,
  p_draft_pick_id uuid DEFAULT NULL,
  p_season_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(p_season_id, public.get_active_season());

  SELECT cubucks_balance INTO v_current_balance
  FROM public.teams
  WHERE id = p_team_id;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Cubucks. Balance: %, Cost: %', v_current_balance, p_amount;
  END IF;

  UPDATE public.teams
  SET
    cubucks_balance = cubucks_balance - p_amount,
    cubucks_total_spent = cubucks_total_spent + p_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  INSERT INTO public.cubucks_transactions (
    team_id,
    season_id,
    transaction_type,
    amount,
    balance_after,
    card_id,
    card_name,
    draft_pick_id,
    description
  ) VALUES (
    p_team_id,
    v_season_id,
    'draft_pick',
    -p_amount,
    v_new_balance,
    p_card_id,
    p_card_name,
    p_draft_pick_id,
    'Drafted ' || p_card_name
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.spend_cubucks_on_draft IS 'Spend Cubucks on a draft pick';

-- -------------------------------------------------------------------------------------------------
-- 11.5 CHECK IF TRADES ARE ENABLED
-- Returns true if trading is enabled globally
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_trades_enabled()
RETURNS boolean AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT setting_value::boolean INTO v_enabled
  FROM public.system_settings
  WHERE setting_key = 'trades_enabled';

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.are_trades_enabled IS 'Check if trading is globally enabled';

-- -------------------------------------------------------------------------------------------------
-- 11.6 EXPIRE OLD TRADES FUNCTION
-- Mark expired trades as expired and notify teams
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_old_trades()
RETURNS void AS $$
DECLARE
  v_trade RECORD;
BEGIN
  FOR v_trade IN
    SELECT id, from_team_id, to_team_id
    FROM public.trades
    WHERE status = 'pending'
      AND deadline < now()
  LOOP
    UPDATE public.trades
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_trade.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.expire_old_trades IS 'Expire old pending trades';

-- -------------------------------------------------------------------------------------------------
-- 11.7 EXECUTE TRADE FUNCTION
-- Transfer items when a trade is accepted
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_trade(p_trade_id uuid)
RETURNS void AS $$
DECLARE
  v_item RECORD;
  v_trade RECORD;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;

  IF v_trade.status != 'accepted' THEN
    RAISE EXCEPTION 'Trade must be accepted to execute';
  END IF;

  FOR v_item IN
    SELECT * FROM public.trade_items WHERE trade_id = p_trade_id
  LOOP
    IF v_item.item_type = 'card' THEN
      UPDATE public.team_draft_picks
      SET team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END
      WHERE id = v_item.draft_pick_id;

    ELSIF v_item.item_type = 'draft_pick' THEN
      UPDATE public.future_draft_picks
      SET team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END,
      is_traded = true,
      traded_to_team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END,
      trade_id = p_trade_id
      WHERE original_team_id = v_item.offering_team_id
        AND season_id = v_item.draft_pick_season_id
        AND round_number = v_item.draft_pick_round;
    END IF;
  END LOOP;

  UPDATE public.trades
  SET completed_at = now(),
      updated_at = now()
  WHERE id = p_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.execute_trade IS 'Execute a trade by transferring items';

-- -------------------------------------------------------------------------------------------------
-- 11.8 SEND MESSAGE FUNCTION
-- Send a message to a user
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_subject text,
  p_message text,
  p_parent_message_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_message_id uuid;
BEGIN
  INSERT INTO public.messages (from_user_id, to_user_id, subject, message, parent_message_id)
  VALUES (p_from_user_id, p_to_user_id, p_subject, p_message, p_parent_message_id)
  RETURNING id INTO v_message_id;

  INSERT INTO public.notifications (user_id, notification_type, trade_id, message)
  VALUES (
    p_to_user_id,
    'new_message',
    NULL,
    'New message: ' || p_subject
  );

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.send_message IS 'Send a message to a user';

-- -------------------------------------------------------------------------------------------------
-- 11.9 NOTIFY USERS OF PHASE CHANGE
-- Notify all users when season phase changes
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_users_of_phase_change(
  p_season_id uuid,
  p_old_phase text,
  p_new_phase text
)
RETURNS integer AS $$
DECLARE
  v_message text;
  v_notification_count integer := 0;
BEGIN
  v_message := 'The season has moved to ' ||
    CASE p_new_phase
      WHEN 'preseason' THEN 'Preseason'
      WHEN 'season' THEN 'Regular Season'
      WHEN 'playoffs' THEN 'Playoffs'
      WHEN 'postseason' THEN 'Post Season'
      ELSE p_new_phase
    END || '!';

  INSERT INTO public.notifications (user_id, notification_type, trade_id, message)
  SELECT
    id,
    'season_phase_change',
    NULL,
    v_message
  FROM public.users;

  GET DIAGNOSTICS v_notification_count = ROW_COUNT;

  RETURN v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.notify_users_of_phase_change IS 'Notify all users of phase change';

-- -------------------------------------------------------------------------------------------------
-- 11.10 UPDATE SEASON PHASE FUNCTION
-- Update season phase and notify users
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_season_phase(
  p_season_id uuid,
  p_new_phase text
)
RETURNS TABLE (
  success boolean,
  old_phase text,
  new_phase text,
  notifications_sent integer
) AS $$
DECLARE
  v_old_phase text;
  v_notifications_sent integer;
BEGIN
  SELECT phase INTO v_old_phase
  FROM public.seasons
  WHERE id = p_season_id;

  IF v_old_phase IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 0;
    RETURN;
  END IF;

  UPDATE public.seasons
  SET
    phase = p_new_phase,
    phase_changed_at = now()
  WHERE id = p_season_id;

  IF v_old_phase != p_new_phase THEN
    v_notifications_sent := public.notify_users_of_phase_change(p_season_id, v_old_phase, p_new_phase);
  ELSE
    v_notifications_sent := 0;
  END IF;

  RETURN QUERY SELECT true, v_old_phase, p_new_phase, v_notifications_sent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_season_phase IS 'Update season phase and notify users';

-- -------------------------------------------------------------------------------------------------
-- 11.11 USER HAS TEAM ROLE FUNCTION
-- Check if a user has a specific role on a team
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_team_role(
  p_user_id uuid,
  p_team_id text,
  p_role text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
      AND tmr.role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_has_team_role IS 'Check if user has a specific team role';

-- -------------------------------------------------------------------------------------------------
-- 11.12 GET USER TEAM ROLES FUNCTION
-- Get all roles for a user on a team
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_team_roles(
  p_user_id uuid,
  p_team_id text
)
RETURNS text[] AS $$
DECLARE
  user_roles text[];
BEGIN
  SELECT ARRAY_AGG(tmr.role)
  INTO user_roles
  FROM public.team_members tm
  JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
  WHERE tm.user_id = p_user_id
    AND tm.team_id = p_team_id;

  RETURN COALESCE(user_roles, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_team_roles IS 'Get all roles for a user on a team';

-- =================================================================================================
-- SECTION 12: TRIGGERS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 12.1 AUTO-CREATE USER PROFILES TRIGGER
-- Automatically create user profile when auth user is created
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_provider text;
BEGIN
  v_provider := NEW.raw_app_meta_data->>'provider';

  INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'provider_id',
    CASE WHEN v_provider = 'discord' THEN NEW.raw_user_meta_data->>'full_name' ELSE NULL END,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------------------------------
-- 12.2 UPDATE TIMESTAMP TRIGGER
-- Generic trigger to update updated_at timestamp
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DROP TRIGGER IF EXISTS on_user_updated ON public.users;
CREATE TRIGGER on_user_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_team_updated ON public.teams;
CREATE TRIGGER on_team_updated
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_season_updated ON public.seasons;
CREATE TRIGGER on_season_updated
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_team_season_stats_updated ON public.team_season_stats;
CREATE TRIGGER on_team_season_stats_updated
  BEFORE UPDATE ON public.team_season_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_team_deck_updated ON public.team_decks;
CREATE TRIGGER on_team_deck_updated
  BEFORE UPDATE ON public.team_decks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_trade_updated ON public.trades;
CREATE TRIGGER on_trade_updated
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_schedule_week_updated ON public.schedule_weeks;
CREATE TRIGGER on_schedule_week_updated
  BEFORE UPDATE ON public.schedule_weeks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_match_updated ON public.matches;
CREATE TRIGGER on_match_updated
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_admin_news_updated ON public.admin_news;
CREATE TRIGGER on_admin_news_updated
  BEFORE UPDATE ON public.admin_news
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------------------------------
-- 12.3 REPORT UPDATE TRIGGER
-- Update report timestamp and resolved_at when status changes
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_report_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reports_update_timestamp ON public.reports;
CREATE TRIGGER reports_update_timestamp
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_report_timestamp();

-- -------------------------------------------------------------------------------------------------
-- 12.4 SEASON PHASE UPDATE TRIGGER
-- Update phase_changed_at when phase changes
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_season_phase_timestamp()
RETURNS trigger AS $$
BEGIN
  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    NEW.phase_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seasons_phase_update ON public.seasons;
CREATE TRIGGER seasons_phase_update
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  WHEN (NEW.phase IS DISTINCT FROM OLD.phase)
  EXECUTE FUNCTION public.update_season_phase_timestamp();

-- -------------------------------------------------------------------------------------------------
-- 12.5 MATCH WINS UPDATE TRIGGER
-- Auto-update match wins based on confirmed game results
-- -------------------------------------------------------------------------------------------------
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
  SELECT home_team_id, away_team_id, best_of
  INTO v_home_team, v_away_team, v_best_of
  FROM public.matches
  WHERE id = NEW.match_id;

  SELECT
    COUNT(*) FILTER (WHERE winner_team_id = v_home_team AND is_confirmed = true),
    COUNT(*) FILTER (WHERE winner_team_id = v_away_team AND is_confirmed = true)
  INTO v_home_wins, v_away_wins
  FROM public.match_games
  WHERE match_id = NEW.match_id;

  v_winner := NULL;
  IF v_home_wins > v_best_of / 2 THEN
    v_winner := v_home_team;
  ELSIF v_away_wins > v_best_of / 2 THEN
    v_winner := v_away_team;
  END IF;

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

-- =================================================================================================
-- SECTION 13: VIEWS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 13.1 TEAM MEMBERS WITH ROLES VIEW
-- See all team members with their roles
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.team_members_with_roles AS
SELECT
  tm.id as member_id,
  tm.user_id,
  tm.user_email,
  u.display_name as user_display_name,
  tm.team_id,
  tm.joined_at,
  COALESCE(
    ARRAY_AGG(tmr.role ORDER BY tmr.role) FILTER (WHERE tmr.role IS NOT NULL),
    ARRAY[]::text[]
  ) as roles,
  COALESCE(
    ARRAY_AGG(tmr.assigned_at ORDER BY tmr.role) FILTER (WHERE tmr.assigned_at IS NOT NULL),
    ARRAY[]::timestamp with time zone[]
  ) as role_assigned_dates
FROM public.team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
LEFT JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
GROUP BY tm.id, tm.user_id, tm.user_email, u.display_name, tm.team_id, tm.joined_at;

COMMENT ON VIEW public.team_members_with_roles IS 'Team members with their assigned roles';

-- -------------------------------------------------------------------------------------------------
-- 13.2 DECK STATS VIEW
-- Get deck statistics
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.deck_stats AS
SELECT
  d.id as deck_id,
  d.deck_name,
  d.team_id,
  COUNT(dc.id) as card_count,
  SUM(dc.quantity) as total_cards,
  AVG(tdp.cmc) as avg_cmc
FROM public.team_decks d
LEFT JOIN public.deck_cards dc ON d.id = dc.deck_id
LEFT JOIN public.team_draft_picks tdp ON dc.draft_pick_id = tdp.id
GROUP BY d.id, d.deck_name, d.team_id;

COMMENT ON VIEW public.deck_stats IS 'Deck statistics including card counts and average CMC';

-- -------------------------------------------------------------------------------------------------
-- 13.3 ACTIVE TRADES VIEW
-- Active trades with team names and time remaining
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.active_trades_view AS
SELECT
  t.id,
  t.from_team_id,
  ft.name as from_team_name,
  ft.emoji as from_team_emoji,
  t.to_team_id,
  tt.name as to_team_name,
  tt.emoji as to_team_emoji,
  t.status,
  t.deadline,
  t.created_at,
  t.updated_at,
  EXTRACT(EPOCH FROM (t.deadline - now())) / 3600 as hours_remaining
FROM public.trades t
JOIN public.teams ft ON t.from_team_id = ft.id
JOIN public.teams tt ON t.to_team_id = tt.id
WHERE t.status IN ('pending', 'accepted')
ORDER BY t.created_at DESC;

COMMENT ON VIEW public.active_trades_view IS 'Active trades with team names and time remaining';

-- -------------------------------------------------------------------------------------------------
-- 13.4 NOTIFICATION COUNTS VIEW
-- Notification counts per user
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.notification_counts_view AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM public.notifications
GROUP BY user_id;

COMMENT ON VIEW public.notification_counts_view IS 'Notification counts per user';

-- -------------------------------------------------------------------------------------------------
-- 13.5 MESSAGE COUNTS VIEW
-- Message counts per user
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.message_counts_view AS
SELECT
  to_user_id as user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM public.messages
GROUP BY to_user_id;

COMMENT ON VIEW public.message_counts_view IS 'Message counts per user (unread and total)';

-- -------------------------------------------------------------------------------------------------
-- 13.6 PENDING REPORTS VIEW
-- Active reports sorted by severity and date
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pending_reports_view AS
SELECT
  r.id,
  r.report_type,
  r.title,
  r.severity,
  r.status,
  r.created_at,
  r.reporter_user_id,
  ru.email as reporter_email,
  r.reported_user_id,
  rpu.email as reported_user_email
FROM public.reports r
LEFT JOIN auth.users ru ON r.reporter_user_id = ru.id
LEFT JOIN auth.users rpu ON r.reported_user_id = rpu.id
WHERE r.status IN ('pending', 'in_review')
ORDER BY
  CASE r.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  r.created_at DESC;

COMMENT ON VIEW public.pending_reports_view IS 'Active reports sorted by severity and date';

-- -------------------------------------------------------------------------------------------------
-- 13.7 CURRENT SEASON INFO VIEW
-- Information about the current active season
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.current_season_info AS
SELECT
  id,
  season_number,
  season_name,
  start_date,
  end_date,
  phase,
  phase_changed_at,
  is_active,
  cubucks_allocation
FROM public.seasons
WHERE is_active = true
ORDER BY start_date DESC
LIMIT 1;

COMMENT ON VIEW public.current_season_info IS 'Information about the current active season';

-- =================================================================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 14.1 USERS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
      OR
      (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
    )
  );

-- -------------------------------------------------------------------------------------------------
-- 14.2 TEAMS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams are viewable by everyone" ON public.teams;
CREATE POLICY "Teams are viewable by everyone"
  ON public.teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.3 TEAM MEMBERS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members are viewable by everyone" ON public.team_members;
CREATE POLICY "Team members are viewable by everyone"
  ON public.team_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;
CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.4 TEAM MEMBER ROLES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_member_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team member roles are viewable by everyone" ON public.team_member_roles;
CREATE POLICY "Team member roles are viewable by everyone"
  ON public.team_member_roles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Captains and admins can manage team roles" ON public.team_member_roles;
CREATE POLICY "Captains and admins can manage team roles"
  ON public.team_member_roles FOR ALL
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
      WHERE tm.user_id = auth.uid()
        AND tmr.role = 'captain'
        AND tm.team_id IN (
          SELECT team_id FROM public.team_members
          WHERE id = team_member_id
        )
    )
  );

-- -------------------------------------------------------------------------------------------------
-- 14.5 TEAM ROLE HISTORY TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_role_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role history is viewable by everyone" ON public.team_role_history;
CREATE POLICY "Role history is viewable by everyone"
  ON public.team_role_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Role history can be created" ON public.team_role_history;
CREATE POLICY "Role history can be created"
  ON public.team_role_history FOR INSERT
  WITH CHECK (true);

-- -------------------------------------------------------------------------------------------------
-- 14.6 USER ROLES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.7 SEASONS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seasons are viewable by everyone" ON public.seasons;
CREATE POLICY "Seasons are viewable by everyone"
  ON public.seasons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage seasons" ON public.seasons;
CREATE POLICY "Admins can manage seasons"
  ON public.seasons FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.8 TEAM SEASON STATS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_season_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team season stats are viewable by everyone" ON public.team_season_stats;
CREATE POLICY "Team season stats are viewable by everyone"
  ON public.team_season_stats FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage team season stats" ON public.team_season_stats;
CREATE POLICY "Authenticated users can manage team season stats"
  ON public.team_season_stats FOR ALL
  TO authenticated
  USING (true);

-- -------------------------------------------------------------------------------------------------
-- 14.9 CARD POOLS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.card_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card pools are viewable by everyone" ON public.card_pools;
CREATE POLICY "Card pools are viewable by everyone"
  ON public.card_pools FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage card pools" ON public.card_pools;
CREATE POLICY "Admins can manage card pools"
  ON public.card_pools FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.10 TEAM DRAFT PICKS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_draft_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Draft picks are viewable by everyone" ON public.team_draft_picks;
CREATE POLICY "Draft picks are viewable by everyone"
  ON public.team_draft_picks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can add draft picks" ON public.team_draft_picks;
CREATE POLICY "Authenticated users can add draft picks"
  ON public.team_draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete draft picks" ON public.team_draft_picks;
CREATE POLICY "Authenticated users can delete draft picks"
  ON public.team_draft_picks FOR DELETE
  TO authenticated
  USING (true);

-- -------------------------------------------------------------------------------------------------
-- 14.11 TEAM DECKS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.team_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public decks are viewable by everyone" ON public.team_decks;
CREATE POLICY "Public decks are viewable by everyone"
  ON public.team_decks FOR SELECT
  USING (is_public = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage decks" ON public.team_decks;
CREATE POLICY "Authenticated users can manage decks"
  ON public.team_decks FOR ALL
  TO authenticated
  USING (true);

-- -------------------------------------------------------------------------------------------------
-- 14.12 DECK CARDS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deck cards are viewable by everyone" ON public.deck_cards;
CREATE POLICY "Deck cards are viewable by everyone"
  ON public.deck_cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage deck cards" ON public.deck_cards;
CREATE POLICY "Authenticated users can manage deck cards"
  ON public.deck_cards FOR ALL
  TO authenticated
  USING (true);

-- -------------------------------------------------------------------------------------------------
-- 14.13 CUBUCKS TRANSACTIONS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.cubucks_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Transactions are viewable by everyone" ON public.cubucks_transactions;
CREATE POLICY "Transactions are viewable by everyone"
  ON public.cubucks_transactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.cubucks_transactions;
CREATE POLICY "Authenticated users can create transactions"
  ON public.cubucks_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------------------------------
-- 14.14 SYSTEM SETTINGS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System settings are viewable by everyone" ON public.system_settings;
CREATE POLICY "System settings are viewable by everyone"
  ON public.system_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.15 TRADES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trades are viewable by involved teams" ON public.trades;
CREATE POLICY "Trades are viewable by involved teams"
  ON public.trades FOR SELECT
  USING (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Team members can create trades" ON public.trades;
CREATE POLICY "Team members can create trades"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    AND public.are_trades_enabled()
  );

DROP POLICY IF EXISTS "Involved teams can update trades" ON public.trades;
CREATE POLICY "Involved teams can update trades"
  ON public.trades FOR UPDATE
  TO authenticated
  USING (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- -------------------------------------------------------------------------------------------------
-- 14.16 TRADE ITEMS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.trade_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trade items are viewable by involved teams" ON public.trade_items;
CREATE POLICY "Trade items are viewable by involved teams"
  ON public.trade_items FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "Trade items can be created with trades" ON public.trade_items;
CREATE POLICY "Trade items can be created with trades"
  ON public.trade_items FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

-- -------------------------------------------------------------------------------------------------
-- 14.17 TRADE MESSAGES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.trade_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trade messages are viewable by involved teams" ON public.trade_messages;
CREATE POLICY "Trade messages are viewable by involved teams"
  ON public.trade_messages FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "Team members can send trade messages" ON public.trade_messages;
CREATE POLICY "Team members can send trade messages"
  ON public.trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- -------------------------------------------------------------------------------------------------
-- 14.18 FUTURE DRAFT PICKS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.future_draft_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Future draft picks are viewable by everyone" ON public.future_draft_picks;
CREATE POLICY "Future draft picks are viewable by everyone"
  ON public.future_draft_picks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create future draft picks" ON public.future_draft_picks;
CREATE POLICY "Authenticated users can create future draft picks"
  ON public.future_draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------------------------------
-- 14.19 MESSAGES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark their received messages as read" ON public.messages;
CREATE POLICY "Users can mark their received messages as read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid());

-- -------------------------------------------------------------------------------------------------
-- 14.20 NOTIFICATIONS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------------------------------------------------
-- 14.21 REPORTS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (reporter_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.22 REPORT ATTACHMENTS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments for their reports" ON public.report_attachments;
CREATE POLICY "Users can view attachments for their reports"
  ON public.report_attachments FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM public.reports
      WHERE reporter_user_id = auth.uid()
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users can add attachments to their reports" ON public.report_attachments;
CREATE POLICY "Users can add attachments to their reports"
  ON public.report_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT id FROM public.reports
      WHERE reporter_user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------------------------------------
-- 14.23 SCHEDULE WEEKS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.schedule_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schedule weeks are viewable by everyone" ON public.schedule_weeks;
CREATE POLICY "Schedule weeks are viewable by everyone"
  ON public.schedule_weeks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage schedule weeks" ON public.schedule_weeks;
CREATE POLICY "Admins can manage schedule weeks"
  ON public.schedule_weeks FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.24 MATCHES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
CREATE POLICY "Matches are viewable by everyone"
  ON public.matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage matches" ON public.matches;
CREATE POLICY "Admins can manage matches"
  ON public.matches FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.25 MATCH GAMES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.match_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Match games are viewable by everyone" ON public.match_games;
CREATE POLICY "Match games are viewable by everyone"
  ON public.match_games FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Team members can report match games" ON public.match_games;
CREATE POLICY "Team members can report match games"
  ON public.match_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    )
  );

DROP POLICY IF EXISTS "Team members can update their match games" ON public.match_games;
CREATE POLICY "Team members can update their match games"
  ON public.match_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    ) OR public.is_admin()
  );

-- -------------------------------------------------------------------------------------------------
-- 14.26 DECK SUBMISSIONS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.deck_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams can view their own deck submissions" ON public.deck_submissions;
CREATE POLICY "Teams can view their own deck submissions"
  ON public.deck_submissions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "Team members can submit decks" ON public.deck_submissions;
CREATE POLICY "Team members can submit decks"
  ON public.deck_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    )
  );

DROP POLICY IF EXISTS "Team members can update their deck submissions" ON public.deck_submissions;
CREATE POLICY "Team members can update their deck submissions"
  ON public.deck_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    ) OR public.is_admin()
  );

-- -------------------------------------------------------------------------------------------------
-- 14.27 DEADLINES TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deadlines are viewable by everyone" ON public.deadlines;
CREATE POLICY "Deadlines are viewable by everyone"
  ON public.deadlines FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage deadlines" ON public.deadlines;
CREATE POLICY "Admins can manage deadlines"
  ON public.deadlines FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 14.28 ADMIN NEWS TABLE POLICIES
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.admin_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published news is viewable by everyone" ON public.admin_news;
CREATE POLICY "Published news is viewable by everyone"
  ON public.admin_news FOR SELECT
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage news" ON public.admin_news;
CREATE POLICY "Admins can manage news"
  ON public.admin_news FOR ALL
  USING (public.is_admin());

-- =================================================================================================
-- SECTION 15: INITIAL DATA
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 15.1 INSERT DEFAULT TEAMS
-- -------------------------------------------------------------------------------------------------
INSERT INTO public.teams (id, name, emoji, motto) VALUES
  ('shards', 'Alara Shards', '🌟', 'Why not both?'),
  ('ninja', 'Kamigawa Ninja', '⛩', 'Omae wa mou shindeiru.'),
  ('creeps', 'Innistrad Creeps', '🧟', 'Graveyard, Gatekeep, Girlboss'),
  ('demigods', 'Theros Demigods', '🌞', 'The Fates will decide'),
  ('guildpact', 'Ravnica Guildpact', '🔗', 'A Championship is won and lost before ever entering the battlefield'),
  ('changelings', 'Lorwyn Changelings', '👽', 'Expect the unexpected'),
  ('hedrons', 'Zendikar Hedrons', '💠', 'Good Vibes, No Escape'),
  ('dragons', 'Tarkir Dragons', '🐲', 'No cost too great')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------------------
-- 15.2 INSERT DEFAULT SYSTEM SETTINGS
-- -------------------------------------------------------------------------------------------------
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('trades_enabled', 'true', 'Enable or disable the trade system globally')
ON CONFLICT (setting_key) DO NOTHING;

-- -------------------------------------------------------------------------------------------------
-- 15.3 CREATE INITIAL SEASON
-- -------------------------------------------------------------------------------------------------
INSERT INTO public.seasons (season_number, season_name, start_date, cubucks_allocation, is_active, phase)
SELECT 1, 'Season 1', NOW(), 1000, true, 'preseason'
WHERE NOT EXISTS (SELECT 1 FROM public.seasons LIMIT 1);

-- -------------------------------------------------------------------------------------------------
-- 15.4 ALLOCATE INITIAL CUBUCKS TO TEAMS
-- -------------------------------------------------------------------------------------------------
DO $$
DECLARE
  team_record RECORD;
  season_id uuid;
BEGIN
  SELECT id INTO season_id FROM public.seasons WHERE is_active = true LIMIT 1;

  IF season_id IS NOT NULL THEN
    FOR team_record IN SELECT id, name FROM public.teams WHERE cubucks_balance = 0 LOOP
      PERFORM public.allocate_cubucks_to_team(
        team_record.id,
        1000,
        season_id,
        'Initial Season 1 allocation',
        NULL
      );
    END LOOP;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------------------
-- 15.5 BACKFILL EXISTING AUTH USERS
-- -------------------------------------------------------------------------------------------------
INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data->>'provider_id',
  CASE WHEN au.raw_app_meta_data->>'provider' = 'discord'
    THEN au.raw_user_meta_data->>'full_name'
    ELSE NULL
  END,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    SPLIT_PART(au.email, '@', 1)
  ),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
);

-- =================================================================================================
-- SECTION 16: VOTING SYSTEM
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 16.1 POLLS TABLE
-- Stores poll questions and configuration
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  allow_multiple_votes boolean DEFAULT false,
  show_results_before_end boolean DEFAULT false,
  total_votes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS polls_is_active_idx ON public.polls(is_active);
CREATE INDEX IF NOT EXISTS polls_ends_at_idx ON public.polls(ends_at);
CREATE INDEX IF NOT EXISTS polls_created_by_idx ON public.polls(created_by);

COMMENT ON TABLE public.polls IS 'Community polls for voting on cube changes and decisions';
COMMENT ON COLUMN public.polls.allow_multiple_votes IS 'If true, users can select multiple options';
COMMENT ON COLUMN public.polls.show_results_before_end IS 'If true, results are visible before voting ends';

-- -------------------------------------------------------------------------------------------------
-- 16.2 POLL OPTIONS TABLE
-- Stores individual options for each poll
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  option_order integer NOT NULL DEFAULT 0,
  vote_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(poll_id, option_order)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS poll_options_order_idx ON public.poll_options(poll_id, option_order);

COMMENT ON TABLE public.poll_options IS 'Options available for each poll';

-- -------------------------------------------------------------------------------------------------
-- 16.3 POLL VOTES TABLE
-- Stores individual user votes
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voted_at timestamp with time zone DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_id_idx ON public.poll_votes(user_id);
CREATE INDEX IF NOT EXISTS poll_votes_option_id_idx ON public.poll_votes(option_id);

COMMENT ON TABLE public.poll_votes IS 'Individual votes cast by users';

-- -------------------------------------------------------------------------------------------------
-- 16.4 POLLS RLS POLICIES
-- -------------------------------------------------------------------------------------------------

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Everyone can view active polls
CREATE POLICY "Anyone can view active polls"
  ON public.polls FOR SELECT
  USING (is_active = true OR auth.uid() IS NOT NULL);

-- Only admins can create polls
CREATE POLICY "Admins can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (public.is_admin());

-- Only admins can update polls
CREATE POLICY "Admins can update polls"
  ON public.polls FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete polls
CREATE POLICY "Admins can delete polls"
  ON public.polls FOR DELETE
  USING (public.is_admin());

-- Everyone can view poll options
CREATE POLICY "Anyone can view poll options"
  ON public.poll_options FOR SELECT
  USING (true);

-- Only admins can create options
CREATE POLICY "Admins can create poll options"
  ON public.poll_options FOR INSERT
  WITH CHECK (public.is_admin());

-- Only admins can update options
CREATE POLICY "Admins can update poll options"
  ON public.poll_options FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete options
CREATE POLICY "Admins can delete poll options"
  ON public.poll_options FOR DELETE
  USING (public.is_admin());

-- Users can view their own votes
CREATE POLICY "Users can view their own votes"
  ON public.poll_votes FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Authenticated users can cast votes
CREATE POLICY "Authenticated users can vote"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes (to change vote)
CREATE POLICY "Users can delete their own votes"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all votes
CREATE POLICY "Admins can view all votes"
  ON public.poll_votes FOR SELECT
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- 16.5 VOTING FUNCTIONS
-- -------------------------------------------------------------------------------------------------

-- Get poll results function
CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id uuid)
RETURNS TABLE(
  option_id uuid,
  option_text text,
  vote_count bigint,
  percentage numeric
) AS $$
DECLARE
  v_total_votes bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_votes
  FROM public.poll_votes
  WHERE poll_id = p_poll_id;

  RETURN QUERY
  SELECT
    po.id,
    po.option_text,
    COUNT(pv.id)::bigint as vote_count,
    CASE
      WHEN v_total_votes > 0 THEN ROUND((COUNT(pv.id)::numeric / v_total_votes::numeric) * 100, 2)
      ELSE 0
    END as percentage
  FROM public.poll_options po
  LEFT JOIN public.poll_votes pv ON pv.option_id = po.id
  WHERE po.poll_id = p_poll_id
  GROUP BY po.id, po.option_text, po.option_order
  ORDER BY po.option_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_poll_results IS 'Get vote counts and percentages for a poll';

-- Check if user has voted function
CREATE OR REPLACE FUNCTION public.user_has_voted(p_poll_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM public.poll_votes
    WHERE poll_id = p_poll_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.user_has_voted IS 'Check if a user has voted on a specific poll';

-- Get user votes for poll function
CREATE OR REPLACE FUNCTION public.get_user_votes(p_poll_id uuid, p_user_id uuid)
RETURNS TABLE(option_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT pv.option_id
  FROM public.poll_votes pv
  WHERE pv.poll_id = p_poll_id AND pv.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_votes IS 'Get the option IDs that a user voted for in a poll';

-- -------------------------------------------------------------------------------------------------
-- 16.6 VOTING TRIGGERS
-- -------------------------------------------------------------------------------------------------

-- Update vote counts trigger
CREATE OR REPLACE FUNCTION public.update_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;

    UPDATE public.polls
    SET total_votes = total_votes + 1
    WHERE id = NEW.poll_id;

    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.poll_options
    SET vote_count = vote_count - 1
    WHERE id = OLD.option_id;

    UPDATE public.polls
    SET total_votes = total_votes - 1
    WHERE id = OLD.poll_id;

    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_poll_vote_counts_trigger
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_poll_vote_counts();

COMMENT ON FUNCTION public.update_poll_vote_counts IS 'Automatically update vote counts when votes change';

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_polls_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_polls_timestamp_trigger
  BEFORE UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_polls_timestamp();

-- -------------------------------------------------------------------------------------------------
-- 16.7 ACTIVE POLLS VIEW
-- Shows currently active polls with vote counts
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.active_polls_view AS
SELECT
  p.id,
  p.title,
  p.description,
  p.starts_at,
  p.ends_at,
  p.allow_multiple_votes,
  p.show_results_before_end,
  p.total_votes,
  p.created_at,
  CASE
    WHEN p.ends_at < now() THEN 'ended'
    WHEN p.starts_at > now() THEN 'upcoming'
    ELSE 'active'
  END as status,
  COUNT(DISTINCT po.id) as option_count
FROM public.polls p
LEFT JOIN public.poll_options po ON po.poll_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.title, p.description, p.starts_at, p.ends_at,
         p.allow_multiple_votes, p.show_results_before_end, p.total_votes, p.created_at
ORDER BY
  CASE
    WHEN p.ends_at < now() THEN 2
    WHEN p.starts_at > now() THEN 1
    ELSE 0
  END,
  p.created_at DESC;

COMMENT ON VIEW public.active_polls_view IS 'View of active polls with status and option counts';

-- =================================================================================================
-- SECTION 17: GRANTS & PERMISSIONS
-- =================================================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select on all tables to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant execute on all functions to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =================================================================================================
-- END OF SCHEMA
-- =================================================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Dynasty Cube Production Schema Installed Successfully!';
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Database features enabled:';
  RAISE NOTICE '  - User management with Discord OAuth';
  RAISE NOTICE '  - Team system with 8 default teams';
  RAISE NOTICE '  - Role-based team management (captain, broker, historian, pilot)';
  RAISE NOTICE '  - Cubucks economy with transaction logging';
  RAISE NOTICE '  - Card drafting and deck building';
  RAISE NOTICE '  - Trading system with future draft picks';
  RAISE NOTICE '  - Messaging and notification system';
  RAISE NOTICE '  - Reports system for issues and bugs';
  RAISE NOTICE '  - Match scheduling and results tracking';
  RAISE NOTICE '  - Admin news system';
  RAISE NOTICE '  - Community voting system with polls';
  RAISE NOTICE '  - Secure Row Level Security (RLS) policies';
  RAISE NOTICE '  - Performance indexes on all critical columns';
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Update admin users: UPDATE public.users SET is_admin = true WHERE email = ''your@email.com'';';
  RAISE NOTICE '  2. Verify RLS policies are working as expected';
  RAISE NOTICE '  3. Import card pool data into card_pools table';
  RAISE NOTICE '  4. Configure system settings in system_settings table';
  RAISE NOTICE '=================================================================================================';
END $$;

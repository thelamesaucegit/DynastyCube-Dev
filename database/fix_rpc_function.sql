-- Updated update_match_game_stats function with better transaction handling
CREATE OR REPLACE FUNCTION update_match_game_stats(
  p_match_id TEXT,
  p_winner_team_id TEXT
)
RETURNS TABLE(
  home_wins INT,
  away_wins INT,
  match_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_home_wins INT;
  v_away_wins INT;
  v_wins_needed INT;
  v_winner_id TEXT;
  v_status TEXT;
BEGIN
  -- Disable RLS for this transaction
  SET LOCAL row_security = off;

  RAISE NOTICE 'Starting update_match_game_stats for match_id: %, winner: %', p_match_id, p_winner_team_id;

  -- Lock the row and get current state
  SELECT
    id,
    home_team_id,
    away_team_id,
    COALESCE(home_team_wins, 0) as home_team_wins,
    COALESCE(away_team_wins, 0) as away_team_wins,
    best_of
  INTO v_match
  FROM matches
  WHERE id = p_match_id::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;

  RAISE NOTICE 'Current match state: home_wins=%, away_wins=%', v_match.home_team_wins, v_match.away_team_wins;

  -- Calculate new win counts by incrementing current values
  IF p_winner_team_id = v_match.home_team_id THEN
    v_home_wins := v_match.home_team_wins + 1;
    v_away_wins := v_match.away_team_wins;
    RAISE NOTICE 'Home team won. New scores: %-%', v_home_wins, v_away_wins;
  ELSE
    v_home_wins := v_match.home_team_wins;
    v_away_wins := v_match.away_team_wins + 1;
    RAISE NOTICE 'Away team won. New scores: %-%', v_home_wins, v_away_wins;
  END IF;

  -- Check if match is complete
  v_wins_needed := CEIL(v_match.best_of::NUMERIC / 2);

  IF v_home_wins >= v_wins_needed THEN
    v_winner_id := v_match.home_team_id;
    v_status := 'completed';
    RAISE NOTICE 'Match completed - home team wins';
  ELSIF v_away_wins >= v_wins_needed THEN
    v_winner_id := v_match.away_team_id;
    v_status := 'completed';
    RAISE NOTICE 'Match completed - away team wins';
  ELSE
    v_winner_id := NULL;
    v_status := 'in_progress';
    RAISE NOTICE 'Match still in progress';
  END IF;

  -- Update the match
  UPDATE matches
  SET
    home_team_wins = v_home_wins,
    away_team_wins = v_away_wins,
    status = v_status,
    winner_team_id = CASE WHEN v_status = 'completed' THEN v_winner_id ELSE NULL END,
    completed_at = CASE WHEN v_status = 'completed' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_match_id::UUID;

  RAISE NOTICE 'Match updated successfully';

  -- Return the new values for verification
  RETURN QUERY SELECT v_home_wins, v_away_wins, v_status;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_match_game_stats(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_match_game_stats(TEXT, TEXT) TO anon;

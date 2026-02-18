-- Reset the Ninja vs Creeps match to 0-0
UPDATE matches
SET
  home_team_wins = 0,
  away_team_wins = 0,
  status = 'scheduled',
  winner_team_id = NULL,
  completed_at = NULL
WHERE home_team_id = 'ninja' AND away_team_id = 'creeps';

-- Also delete any existing game records for this match so you can re-record from scratch
DELETE FROM match_games
WHERE match_id IN (
  SELECT id FROM matches
  WHERE home_team_id = 'ninja' AND away_team_id = 'creeps'
);

-- Verify the reset worked
SELECT
  id,
  home_team_id,
  away_team_id,
  home_team_wins,
  away_team_wins,
  status,
  winner_team_id
FROM matches
WHERE home_team_id = 'ninja' AND away_team_id = 'creeps';

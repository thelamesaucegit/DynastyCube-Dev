-- Check the match that was just updated
SELECT
  id,
  home_team_id,
  away_team_id,
  home_team_wins,
  away_team_wins,
  status,
  winner_team_id
FROM matches
WHERE id = '51a37059-a849-4398-8a15-20344c59c132';

-- Check all matches for ninja team
SELECT
  id,
  home_team_id,
  away_team_id,
  home_team_wins,
  away_team_wins,
  status
FROM matches
WHERE home_team_id = 'ninja' OR away_team_id = 'ninja'
ORDER BY created_at DESC;

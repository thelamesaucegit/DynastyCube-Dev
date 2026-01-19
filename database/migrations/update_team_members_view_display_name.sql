-- Migration: Add display_name to team_members_with_roles view
-- Date: 2025-01-17
-- Description: Update the team_members_with_roles view to include user display names
--              for security purposes (showing display names instead of emails)

-- Drop the existing view
DROP VIEW IF EXISTS public.team_members_with_roles CASCADE;

-- Recreate the view with display_name
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

COMMENT ON VIEW public.team_members_with_roles IS 'Team members with their assigned roles and display names';

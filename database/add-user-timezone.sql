-- =================================
-- ADD TIMEZONE SUPPORT TO USER PROFILES
-- =================================

-- Add timezone column to users table
-- Default to UTC, users can change via their account settings
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Add index for faster timezone queries
CREATE INDEX IF NOT EXISTS users_timezone_idx ON public.users(timezone);

-- Add comment to explain the column
COMMENT ON COLUMN public.users.timezone IS 'User timezone preference in IANA timezone format (e.g., America/New_York, Europe/London, Asia/Tokyo)';

-- =================================
-- NOTES
-- =================================

-- This adds timezone support to user profiles
-- Users can set their timezone in account settings
-- All timestamps throughout the app will be displayed in the user's timezone
-- Valid timezone values follow the IANA Time Zone Database format
-- Examples: UTC, America/New_York, Europe/London, Asia/Tokyo, Australia/Sydney

-- To update a user's timezone:
-- UPDATE public.users
-- SET timezone = 'America/New_York'
-- WHERE email = 'user@example.com';

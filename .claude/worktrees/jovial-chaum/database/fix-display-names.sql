-- =================================================
-- FIX DISPLAY NAMES MIGRATION
-- =================================================
-- This migration fixes the user display name system by:
-- 1. Populating display_name for existing users
-- 2. Fixing the messages_with_user_info view
-- 3. Updating the user creation trigger
--
-- Run this migration to fix the full_name column error
-- =================================================

-- =================================
-- STEP 1: Update existing users
-- =================================

-- Update display_name for users who don't have one set
-- Priority: discord_username > username from email
UPDATE public.users
SET display_name = COALESCE(
  discord_username,
  SPLIT_PART(email, '@', 1)  -- Use email username part as fallback
)
WHERE display_name IS NULL OR display_name = '';

-- Update discord_username and display_name from auth metadata for existing Discord users
UPDATE public.users u
SET
  discord_username = COALESCE(u.discord_username, au.raw_user_meta_data->>'full_name'),
  display_name = COALESCE(u.display_name, au.raw_user_meta_data->>'full_name'),
  avatar_url = COALESCE(
    u.avatar_url,
    au.raw_user_meta_data->>'avatar_url',
    au.raw_user_meta_data->>'picture'
  )
FROM auth.users au
WHERE u.id = au.id
  AND au.raw_app_meta_data->>'provider' = 'discord';

-- Update display_name for Google users (but don't set discord_username)
UPDATE public.users u
SET
  display_name = COALESCE(u.display_name, au.raw_user_meta_data->>'full_name'),
  avatar_url = COALESCE(
    u.avatar_url,
    au.raw_user_meta_data->>'picture',
    au.raw_user_meta_data->>'avatar_url'
  )
FROM auth.users au
WHERE u.id = au.id
  AND au.raw_app_meta_data->>'provider' != 'discord';

-- =================================
-- STEP 2: Recreate the messages view
-- =================================

-- Drop the old view if it exists
DROP VIEW IF EXISTS messages_with_user_info;

-- Create view for messages with user info
CREATE OR REPLACE VIEW messages_with_user_info AS
SELECT
  m.id,
  m.from_user_id,
  m.to_user_id,
  m.subject,
  m.message,
  m.is_read,
  m.parent_message_id,
  m.created_at,

  -- From user info
  from_user.email as from_user_email,
  COALESCE(
    from_user_data.display_name,
    from_user_data.discord_username,
    from_user.email,
    'Unknown User'
  ) as from_user_name,

  -- To user info
  to_user.email as to_user_email,
  COALESCE(
    to_user_data.display_name,
    to_user_data.discord_username,
    to_user.email,
    'Unknown User'
  ) as to_user_name

FROM messages m
LEFT JOIN auth.users from_user ON m.from_user_id = from_user.id
LEFT JOIN public.users from_user_data ON m.from_user_id = from_user_data.id
LEFT JOIN auth.users to_user ON m.to_user_id = to_user.id
LEFT JOIN public.users to_user_data ON m.to_user_id = to_user_data.id;

-- Grant access to authenticated users
GRANT SELECT ON messages_with_user_info TO authenticated;

-- Add RLS to the view (inherits from messages table)
ALTER VIEW messages_with_user_info SET (security_invoker = true);

-- Comment
COMMENT ON VIEW messages_with_user_info IS 'Messages with sender and recipient user information for easy display';

-- =================================
-- STEP 3: Update the trigger function
-- =================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_provider text;
BEGIN
  -- Get the OAuth provider (discord, google, etc.)
  v_provider := NEW.raw_app_meta_data->>'provider';

  INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    -- Store provider_id in discord_id (for Discord users, this is their Discord ID)
    NEW.raw_user_meta_data->>'provider_id',
    -- Only store discord_username for Discord OAuth
    CASE WHEN v_provider = 'discord' THEN NEW.raw_user_meta_data->>'full_name' ELSE NULL END,
    -- Set display_name to full_name from OAuth provider (users can change this later)
    NEW.raw_user_meta_data->>'full_name',
    -- Handle both Discord (avatar_url) and Google (picture) avatar fields
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- SUCCESS MESSAGE
-- =================================

DO $$
BEGIN
  RAISE NOTICE '✓ Display names migration completed successfully';
  RAISE NOTICE '✓ Updated existing user display names';
  RAISE NOTICE '✓ Recreated messages_with_user_info view';
  RAISE NOTICE '✓ Updated user creation trigger';
  RAISE NOTICE '';
  RAISE NOTICE 'Users can now update their display_name in their profile settings';
END $$;

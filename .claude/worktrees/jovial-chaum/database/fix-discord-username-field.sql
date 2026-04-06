-- =============================================================
-- FIX: discord_username column was storing full_name (global_name/display name)
--      instead of the actual Discord @username handle.
--
-- RUN THIS ONCE in Supabase SQL Editor to backfill existing users.
-- =============================================================

-- Step 1: Update existing Discord users to use the real username (@handle)
UPDATE public.users u
SET discord_username = au.raw_user_meta_data->>'username'
FROM auth.users au
WHERE u.id = au.id
  AND au.raw_app_meta_data->>'provider' = 'discord'
  AND au.raw_user_meta_data->>'username' IS NOT NULL;

-- Step 2: Fix the trigger so new signups also get the correct value
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
    -- Use 'username' (the @handle) not 'full_name' (which is the display name / global_name)
    CASE WHEN v_provider = 'discord' THEN NEW.raw_user_meta_data->>'username' ELSE NULL END,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the fix (optional check query):
-- SELECT u.id, u.discord_username, au.raw_user_meta_data->>'username' AS auth_username
-- FROM public.users u
-- JOIN auth.users au ON u.id = au.id
-- WHERE au.raw_app_meta_data->>'provider' = 'discord';

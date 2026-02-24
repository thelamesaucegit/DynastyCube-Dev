-- =================================
-- DYNASTY CUBE USER PROFILES SCHEMA
-- =================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================
-- USER PROFILES TABLE
-- Store additional user data beyond auth.users
-- =================================
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_is_admin_idx ON public.users(is_admin);
CREATE INDEX IF NOT EXISTS users_discord_id_idx ON public.users(discord_id);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile (but not is_admin unless they're already admin)
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      -- Prevent non-admins from changing is_admin
      is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
      OR
      -- Allow admins to change is_admin
      (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
    )
  );

-- =================================
-- TRIGGER TO AUTO-CREATE USER PROFILES
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
    -- Only store discord_username for Discord OAuth — use 'username' (the @handle), not 'full_name' (global_name/display name)
    CASE WHEN v_provider = 'discord' THEN NEW.raw_user_meta_data->>'username' ELSE NULL END,
    -- Set display_name to full_name from OAuth provider, with fallback to email username
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)  -- Fallback: use email username part
    ),
    -- Handle both Discord (avatar_url) and Google (picture) avatar fields
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================
-- FUNCTION TO UPDATE TIMESTAMP
-- =================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_updated ON public.users;
CREATE TRIGGER on_user_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =================================
-- BACKFILL EXISTING AUTH USERS
-- =================================

-- Create profiles for existing auth users (if any)
INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data->>'provider_id',
  CASE WHEN au.raw_app_meta_data->>'provider' = 'discord'
    THEN au.raw_user_meta_data->>'username'
    ELSE NULL
  END,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    SPLIT_PART(au.email, '@', 1)  -- Fallback: use email username part
  ),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
);

-- =================================
-- NOTES
-- =================================

-- This table stores additional user data that extends auth.users
-- The is_admin flag controls access to admin features
-- The trigger automatically creates a profile when a user signs up
-- Existing users are backfilled with the INSERT statement above

-- To grant admin access to a user:
-- UPDATE public.users
-- SET is_admin = true
-- WHERE email = 'admin@example.com';

-- To check admin users:
-- SELECT id, email, is_admin, created_at
-- FROM public.users
-- WHERE is_admin = true;

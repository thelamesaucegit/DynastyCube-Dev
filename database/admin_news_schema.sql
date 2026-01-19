-- =====================================================
-- Admin News Table Schema for Supabase
-- =====================================================
-- This table stores admin news posts that can be published
-- to the community on the home page.
-- =====================================================

-- Create the admin_news table
CREATE TABLE IF NOT EXISTS public.admin_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_news_author_id ON public.admin_news(author_id);
CREATE INDEX IF NOT EXISTS idx_admin_news_is_published ON public.admin_news(is_published);
CREATE INDEX IF NOT EXISTS idx_admin_news_created_at ON public.admin_news(created_at DESC);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.admin_news;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.admin_news
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on the table
ALTER TABLE public.admin_news ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published news
CREATE POLICY "Anyone can view published news"
    ON public.admin_news
    FOR SELECT
    USING (is_published = true);

-- Policy: Admins can read all news (published and unpublished)
-- Note: You'll need to replace 'admin@example.com' with actual admin emails
-- Or implement a proper admin role system
CREATE POLICY "Admins can view all news"
    ON public.admin_news
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' IN (
            -- Add your admin emails here
            'admin@example.com',
            'youremail@example.com'
        )
    );

-- Policy: Admins can insert news
CREATE POLICY "Admins can create news"
    ON public.admin_news
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'email' IN (
            -- Add your admin emails here
            'admin@example.com',
            'youremail@example.com'
        )
    );

-- Policy: Admins can update news
CREATE POLICY "Admins can update news"
    ON public.admin_news
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' IN (
            -- Add your admin emails here
            'admin@example.com',
            'youremail@example.com'
        )
    );

-- Policy: Admins can delete news
CREATE POLICY "Admins can delete news"
    ON public.admin_news
    FOR DELETE
    USING (
        auth.jwt() ->> 'email' IN (
            -- Add your admin emails here
            'admin@example.com',
            'youremail@example.com'
        )
    );

-- =====================================================
-- Optional: Create a users table if you don't have one
-- =====================================================
-- This is needed for the foreign key relationship and
-- for displaying author names. Skip if you already have
-- a users table.

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT,
    discord_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view user display names
CREATE POLICY "Anyone can view user display names"
    ON public.users
    FOR SELECT
    USING (true);

-- =====================================================
-- Sample Data (Optional)
-- =====================================================
-- Uncomment to insert sample news posts

-- INSERT INTO public.admin_news (title, content, is_published) VALUES
-- ('Welcome to The Dynasty Cube!', 'We are excited to launch our new platform for the Dynasty Cube community. Stay tuned for updates!', true),
-- ('New Season Starting Soon', 'Season 1 will begin next week. Make sure your team is ready to draft!', true),
-- ('Draft Rules Updated', 'We have made some changes to the draft rules. Please review them before the next draft.', false);

-- =====================================================
-- Cleanup (Optional)
-- =====================================================
-- Uncomment these lines if you need to remove the table
-- and start fresh

-- DROP TRIGGER IF EXISTS set_updated_at ON public.admin_news;
-- DROP FUNCTION IF EXISTS public.handle_updated_at();
-- DROP TABLE IF EXISTS public.admin_news CASCADE;

-- =====================================================
-- Notes
-- =====================================================
-- 1. Make sure to update the admin email addresses in the RLS policies
-- 2. For production, consider implementing a proper role-based access control
--    system using a user_roles table instead of hardcoding emails
-- 3. The author_id references auth.users(id), so users must be authenticated
-- 4. The is_published flag controls whether news appears on the home page
-- 5. The updated_at field is automatically managed by the trigger

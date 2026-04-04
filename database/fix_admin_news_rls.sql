-- =====================================================
-- Fix Admin News RLS Policies
-- =====================================================
-- This script fixes the Row Level Security policies
-- for the admin_news table to allow admins to create news
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view published news" ON public.admin_news;
DROP POLICY IF EXISTS "Admins can view all news" ON public.admin_news;
DROP POLICY IF EXISTS "Admins can create news" ON public.admin_news;
DROP POLICY IF EXISTS "Admins can update news" ON public.admin_news;
DROP POLICY IF EXISTS "Admins can delete news" ON public.admin_news;

-- =====================================================
-- OPTION 1: Temporary - Allow all authenticated users
-- =====================================================
-- This is simpler for testing. Use this first, then
-- switch to Option 2 for production

-- Anyone can view published news
CREATE POLICY "Anyone can view published news"
    ON public.admin_news
    FOR SELECT
    USING (is_published = true);

-- Authenticated users can view all news
CREATE POLICY "Authenticated users can view all news"
    ON public.admin_news
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Authenticated users can create news
CREATE POLICY "Authenticated users can create news"
    ON public.admin_news
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update news
CREATE POLICY "Authenticated users can update news"
    ON public.admin_news
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete news
CREATE POLICY "Authenticated users can delete news"
    ON public.admin_news
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- OPTION 2: Production - Email-based admin access
-- =====================================================
-- Uncomment these policies and add your actual admin emails
-- Comment out Option 1 policies above when using this

/*
-- Anyone can view published news
CREATE POLICY "Anyone can view published news"
    ON public.admin_news
    FOR SELECT
    USING (is_published = true);

-- Admins can view all news
CREATE POLICY "Admins can view all news"
    ON public.admin_news
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' IN (
            -- ⚠️ REPLACE THESE WITH YOUR ACTUAL ADMIN EMAILS
            'your-email@example.com',
            'another-admin@example.com'
        )
    );

-- Admins can create news
CREATE POLICY "Admins can create news"
    ON public.admin_news
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'email' IN (
            -- ⚠️ REPLACE THESE WITH YOUR ACTUAL ADMIN EMAILS
            'your-email@example.com',
            'another-admin@example.com'
        )
    );

-- Admins can update news
CREATE POLICY "Admins can update news"
    ON public.admin_news
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' IN (
            -- ⚠️ REPLACE THESE WITH YOUR ACTUAL ADMIN EMAILS
            'your-email@example.com',
            'another-admin@example.com'
        )
    );

-- Admins can delete news
CREATE POLICY "Admins can delete news"
    ON public.admin_news
    FOR DELETE
    USING (
        auth.jwt() ->> 'email' IN (
            -- ⚠️ REPLACE THESE WITH YOUR ACTUAL ADMIN EMAILS
            'your-email@example.com',
            'another-admin@example.com'
        )
    );
*/

-- =====================================================
-- OPTION 3: Most Secure - Admin role in users table
-- =====================================================
-- This is the best long-term solution

/*
-- First, add an is_admin column to users table if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Set specific users as admins (replace with your actual user IDs or emails)
-- You can find your user ID in Supabase Dashboard > Authentication > Users
UPDATE public.users
SET is_admin = TRUE
WHERE email IN (
    'your-email@example.com',
    'another-admin@example.com'
);

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view published news" ON public.admin_news;
DROP POLICY IF EXISTS "Authenticated users can view all news" ON public.admin_news;
DROP POLICY IF EXISTS "Authenticated users can create news" ON public.admin_news;
DROP POLICY IF EXISTS "Authenticated users can update news" ON public.admin_news;
DROP POLICY IF EXISTS "Authenticated users can delete news" ON public.admin_news;

-- Anyone can view published news
CREATE POLICY "Anyone can view published news"
    ON public.admin_news
    FOR SELECT
    USING (is_published = true);

-- Admins can view all news
CREATE POLICY "Admins can view all news"
    ON public.admin_news
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Admins can create news
CREATE POLICY "Admins can create news"
    ON public.admin_news
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Admins can update news
CREATE POLICY "Admins can update news"
    ON public.admin_news
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Admins can delete news
CREATE POLICY "Admins can delete news"
    ON public.admin_news
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );
*/

-- =====================================================
-- Verification Queries
-- =====================================================
-- Run these to check your setup:

-- Check current policies
-- SELECT * FROM pg_policies WHERE tablename = 'admin_news';

-- Check your current user email
-- SELECT auth.jwt() ->> 'email' as current_user_email;

-- Check if you're authenticated
-- SELECT auth.uid() as current_user_id;

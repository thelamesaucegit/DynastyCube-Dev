-- =====================================================
-- FIX: Countdown Timer RLS Policies
-- =====================================================
-- The original policies used hardcoded email addresses,
-- which prevented other admins from updating timers.
-- This migration replaces them with public.is_admin()
-- which checks the is_admin column on the users table.
-- =====================================================

-- Drop the old hardcoded-email policies
DROP POLICY IF EXISTS "Admins can view all countdown timers" ON public.countdown_timers;
DROP POLICY IF EXISTS "Admins can create countdown timers" ON public.countdown_timers;
DROP POLICY IF EXISTS "Admins can update countdown timers" ON public.countdown_timers;
DROP POLICY IF EXISTS "Admins can delete countdown timers" ON public.countdown_timers;

-- Recreate using public.is_admin() (matches the pattern used by teams, team_members, etc.)
CREATE POLICY "Admins can view all countdown timers"
    ON public.countdown_timers
    FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can create countdown timers"
    ON public.countdown_timers
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update countdown timers"
    ON public.countdown_timers
    FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete countdown timers"
    ON public.countdown_timers
    FOR DELETE
    USING (public.is_admin());

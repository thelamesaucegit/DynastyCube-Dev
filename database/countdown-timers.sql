-- =====================================================
-- Countdown Timers Table Schema for Supabase
-- =====================================================
-- This table stores countdown timers that can be displayed
-- on the homepage. Only one timer is active at a time.
-- When a timer expires, a configurable link is revealed.
-- =====================================================

-- Create the countdown_timers table
CREATE TABLE IF NOT EXISTS public.countdown_timers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    link_url TEXT NOT NULL,
    link_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_countdown_timers_is_active ON public.countdown_timers(is_active);
CREATE INDEX IF NOT EXISTS idx_countdown_timers_end_time ON public.countdown_timers(end_time);
CREATE INDEX IF NOT EXISTS idx_countdown_timers_created_at ON public.countdown_timers(created_at DESC);

-- Create trigger to automatically update updated_at
-- (Reuses the existing handle_updated_at function from admin_news_schema.sql)
DROP TRIGGER IF EXISTS set_updated_at ON public.countdown_timers;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.countdown_timers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on the table
ALTER TABLE public.countdown_timers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active timers
CREATE POLICY "Anyone can view active countdown timers"
    ON public.countdown_timers
    FOR SELECT
    USING (is_active = true);

-- Policy: Admins can view all timers
CREATE POLICY "Admins can view all countdown timers"
    ON public.countdown_timers
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' IN (
            'admin@dynastycube.com',
            'amonteallen@gmail.com'
        )
    );

-- Policy: Admins can create timers
CREATE POLICY "Admins can create countdown timers"
    ON public.countdown_timers
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'email' IN (
            'admin@dynastycube.com',
            'amonteallen@gmail.com'
        )
    );

-- Policy: Admins can update timers
CREATE POLICY "Admins can update countdown timers"
    ON public.countdown_timers
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' IN (
            'admin@dynastycube.com',
            'amonteallen@gmail.com'
        )
    );

-- Policy: Admins can delete timers
CREATE POLICY "Admins can delete countdown timers"
    ON public.countdown_timers
    FOR DELETE
    USING (
        auth.jwt() ->> 'email' IN (
            'admin@dynastycube.com',
            'amonteallen@gmail.com'
        )
    );

-- =====================================================
-- Notes
-- =====================================================
-- 1. Update admin emails in RLS policies to match your admin list
-- 2. Only one timer should be active at a time (enforced in application logic)
-- 3. The handle_updated_at() function must exist (created in admin_news_schema.sql)
-- 4. When activating a timer, deactivate all others first

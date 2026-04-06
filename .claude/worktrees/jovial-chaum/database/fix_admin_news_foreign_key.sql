-- =====================================================
-- Fix admin_news Foreign Key Relationship
-- =====================================================
-- This fixes the relationship between admin_news and users
-- =====================================================

-- Drop the existing foreign key constraint
ALTER TABLE public.admin_news
DROP CONSTRAINT IF EXISTS admin_news_author_id_fkey;

-- Recreate the foreign key to point to public.users instead of auth.users
ALTER TABLE public.admin_news
ADD CONSTRAINT admin_news_author_id_fkey
FOREIGN KEY (author_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

-- Verify the constraint was created
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'admin_news';

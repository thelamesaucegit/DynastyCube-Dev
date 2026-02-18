-- =================================
-- ESSENCE PERSONAL CURRENCY SYSTEM
-- Personal user-level currency
-- Each user starts with 1 Essence
-- Admins can grant to individual or all users
-- =================================

-- =================================
-- 1. ADD ESSENCE COLUMNS TO USERS
-- =================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS essence_balance integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS essence_total_earned integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS essence_total_spent integer DEFAULT 0;

COMMENT ON COLUMN public.users.essence_balance IS 'Current available Essence for this user';
COMMENT ON COLUMN public.users.essence_total_earned IS 'Total Essence earned all-time';
COMMENT ON COLUMN public.users.essence_total_spent IS 'Total Essence spent all-time';

-- =================================
-- 2. ESSENCE TRANSACTIONS TABLE
-- Track all Essence movements
-- =================================
CREATE TABLE IF NOT EXISTS public.essence_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('grant', 'spend', 'refund', 'adjustment')),
  amount integer NOT NULL,          -- Positive for grants, negative for spending
  balance_after integer NOT NULL,   -- Snapshot of balance after this transaction
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.essence_transactions IS 'Audit log of all Essence transactions';
COMMENT ON COLUMN public.essence_transactions.transaction_type IS 'Type: grant, spend, refund, adjustment';
COMMENT ON COLUMN public.essence_transactions.amount IS 'Positive for earning, negative for spending';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS essence_transactions_user_id_idx ON public.essence_transactions(user_id);
CREATE INDEX IF NOT EXISTS essence_transactions_type_idx ON public.essence_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS essence_transactions_created_at_idx ON public.essence_transactions(created_at DESC);

-- =================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =================================

-- Enable RLS
ALTER TABLE public.essence_transactions ENABLE ROW LEVEL SECURITY;

-- Transactions: All authenticated users can read
CREATE POLICY "essence_transactions_select_authenticated"
  ON public.essence_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Transactions: Authenticated users can insert (via RPC functions)
CREATE POLICY "essence_transactions_insert_authenticated"
  ON public.essence_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =================================
-- 4. GRANT ACCESS
-- =================================
GRANT SELECT ON public.essence_transactions TO anon;
GRANT SELECT ON public.essence_transactions TO authenticated;
GRANT INSERT ON public.essence_transactions TO authenticated;

-- =================================
-- 5. RPC FUNCTION: GRANT ESSENCE
-- Atomically updates balance + creates transaction
-- =================================
CREATE OR REPLACE FUNCTION public.grant_essence_to_user(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Update user balance
  UPDATE public.users
  SET
    essence_balance = essence_balance + p_amount,
    essence_total_earned = essence_total_earned + p_amount,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING essence_balance INTO v_new_balance;

  -- Check user exists
  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create transaction record
  INSERT INTO public.essence_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_user_id,
    'grant',
    p_amount,
    v_new_balance,
    COALESCE(p_description, 'Essence granted'),
    p_created_by
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- =================================
-- 6. RPC FUNCTION: SPEND ESSENCE
-- For future spending features
-- =================================
CREATE OR REPLACE FUNCTION public.spend_essence(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check current balance
  SELECT essence_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Essence. Have %, need %', v_current_balance, p_amount;
  END IF;

  -- Update user balance
  UPDATE public.users
  SET
    essence_balance = essence_balance - p_amount,
    essence_total_spent = essence_total_spent + p_amount,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING essence_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.essence_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_user_id,
    'spend',
    -p_amount,
    v_new_balance,
    COALESCE(p_description, 'Essence spent'),
    p_created_by
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

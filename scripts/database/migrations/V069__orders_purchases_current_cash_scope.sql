ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS cash_session_id uuid NULL;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS cash_session_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_orders_cash_session'
      AND conrelid = to_regclass('public.orders')
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT fk_orders_cash_session
      FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_purchases_cash_session'
      AND conrelid = to_regclass('public.purchases')
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT fk_purchases_cash_session
      FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_cash_session
  ON public.orders (cash_session_id);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_cash_session
  ON public.orders (tenant_id, cash_session_id);

CREATE INDEX IF NOT EXISTS idx_purchases_cash_session
  ON public.purchases (cash_session_id);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant_cash_session
  ON public.purchases (tenant_id, cash_session_id);

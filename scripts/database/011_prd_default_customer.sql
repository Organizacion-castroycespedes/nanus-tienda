ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tenant_default
  ON public.customers (tenant_id)
  WHERE is_default = true;

INSERT INTO public.customers (
  id,
  tenant_id,
  name,
  document_number,
  is_default,
  is_active
)
SELECT
  gen_random_uuid(),
  t.id,
  'CONSUMIDOR FINAL',
  '0000000000',
  true,
  true
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.customers c
  WHERE c.tenant_id = t.id
    AND c.is_default = true
);

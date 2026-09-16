-- POS sale creation recovery. One key is unique inside one tenant and is
-- completed in the same transaction that creates the sale.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_sales_tenant_id'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT uq_sales_tenant_id UNIQUE (tenant_id, id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.sale_creation_idempotency (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  sale_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, idempotency_key),
  CONSTRAINT chk_sale_creation_idempotency_hash
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT uq_sale_creation_idempotency_sale
    UNIQUE (tenant_id, sale_id),
  CONSTRAINT fk_sale_creation_idempotency_sale
    FOREIGN KEY (tenant_id, sale_id)
    REFERENCES public.sales (tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_creation_idempotency_sale
  ON public.sale_creation_idempotency (tenant_id, sale_id)
  WHERE sale_id IS NOT NULL;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_user') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.sale_creation_idempotency TO manus_user';
  END IF;
END
$grant$;

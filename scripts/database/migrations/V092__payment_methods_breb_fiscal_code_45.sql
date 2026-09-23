-- QR Bre-B usa el medio DIAN 45 (transferencia credito) con identificador 1.
-- El check de V083 solo aceptaba 10, 47 y 49. Se reemplaza antes de asignar 45.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.payment_methods') IS NULL THEN
    RAISE EXCEPTION 'Required table public.payment_methods does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_methods'
      AND column_name = 'electronic_payment_means_code'
  ) THEN
    RAISE EXCEPTION 'Required column public.payment_methods.electronic_payment_means_code does not exist';
  END IF;
END $$;

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_electronic_fiscal_pair_check;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_electronic_fiscal_pair_check CHECK (
    electronic_billing_enabled = FALSE
    OR (
      electronic_payment_means_code IN ('10', '47', '45', '49')
      AND electronic_payment_means_id = '1'
    )
  );

INSERT INTO public.payment_methods (
  tenant_id, codigo, nombre, tipo, requires_reference,
  requires_financial_institution, icon, color, sort_order,
  allows_change, active,
  electronic_billing_enabled,
  electronic_payment_means_code,
  electronic_payment_means_id
)
SELECT
  t.id,
  'QR_BREB',
  'QR Bre-B',
  'DIGITAL',
  TRUE,
  TRUE,
  'qr-breb',
  '#0F766E',
  30,
  FALSE,
  TRUE,
  TRUE,
  '45',
  '1'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.payment_methods pm
  WHERE pm.tenant_id = t.id
    AND UPPER(pm.codigo) = 'QR_BREB'
);

UPDATE public.payment_methods
SET electronic_billing_enabled = TRUE,
    electronic_payment_means_code = '45',
    electronic_payment_means_id = '1',
    updated_at = NOW()
WHERE UPPER(codigo) = 'QR_BREB'
  AND (
    electronic_billing_enabled IS DISTINCT FROM TRUE
    OR electronic_payment_means_code IS DISTINCT FROM '45'
    OR electronic_payment_means_id IS DISTINCT FROM '1'
  );

COMMIT;

-- Keep one active default electronic-billing configuration per tenant.
-- Disabled configurations are never valid defaults.

BEGIN;

UPDATE public.tenant_electronic_billing_configs
SET is_default = FALSE,
    updated_at = NOW()
WHERE enabled = FALSE
  AND is_default = TRUE;

WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM public.tenant_electronic_billing_configs
  WHERE enabled = TRUE
    AND is_default = TRUE
)
UPDATE public.tenant_electronic_billing_configs AS config
SET is_default = FALSE,
    updated_at = NOW()
FROM ranked_defaults AS ranked
WHERE config.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_electronic_billing_configs_enabled_default
  ON public.tenant_electronic_billing_configs (tenant_id)
  WHERE enabled = TRUE
    AND is_default = TRUE;

COMMIT;

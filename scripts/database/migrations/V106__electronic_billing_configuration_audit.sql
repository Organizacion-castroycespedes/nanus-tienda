CREATE TABLE IF NOT EXISTS public.electronic_billing_configuration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  config_id UUID,
  action TEXT NOT NULL,
  actor_source TEXT NOT NULL DEFAULT 'MANUS_SUPER_ADMIN_PROXY',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_billing_configuration_audit_action
    CHECK (action IN ('CONFIG_CREATED', 'CONFIG_METADATA_UPDATED', 'CONFIG_CREDENTIAL_REPLACED'))
);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_configuration_audit_tenant
  ON public.electronic_billing_configuration_audit (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_configuration_audit_config
  ON public.electronic_billing_configuration_audit (config_id, created_at DESC);

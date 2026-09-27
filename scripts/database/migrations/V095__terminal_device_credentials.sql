BEGIN;

-- Registro administrativo solamente. Nunca almacena el token del Agent.
CREATE TABLE IF NOT EXISTS public.terminal_device_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_device_id uuid NOT NULL,
  credential_id text NOT NULL,
  verifier_version text NOT NULL DEFAULT 'sha256-v1',
  verifier_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  rotated_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by text NULL,
  revoked_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terminal_device_credentials_device_fk
    FOREIGN KEY (terminal_device_id, tenant_id)
    REFERENCES public.terminal_devices(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT terminal_device_credentials_status_check
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'ROTATED', 'REVOKED')),
  CONSTRAINT terminal_device_credentials_id_not_blank
    CHECK (btrim(credential_id) <> ''),
  CONSTRAINT terminal_device_credentials_verifier_check
    CHECK (verifier_sha256 ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT terminal_device_credentials_dates_check
    CHECK (expires_at IS NULL OR expires_at > issued_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_credentials_credential_id_unique
  ON public.terminal_device_credentials (credential_id);
CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_credentials_active_device_unique
  ON public.terminal_device_credentials (terminal_device_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS terminal_device_credentials_tenant_status_idx
  ON public.terminal_device_credentials (tenant_id, status);

DROP TRIGGER IF EXISTS trg_terminal_device_credentials_updated_at
  ON public.terminal_device_credentials;
CREATE TRIGGER trg_terminal_device_credentials_updated_at
BEFORE UPDATE ON public.terminal_device_credentials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMIT;

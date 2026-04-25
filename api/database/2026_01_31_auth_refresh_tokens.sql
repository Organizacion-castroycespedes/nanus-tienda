CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user
  ON auth_refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_tenant
  ON auth_refresh_tokens(tenant_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires
  ON auth_refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked
  ON auth_refresh_tokens(revoked_at);

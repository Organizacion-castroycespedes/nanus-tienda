CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_user_active
  ON auth_sessions(user_id, tenant_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token
  ON auth_sessions(refresh_token);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant
  ON auth_sessions(tenant_id);

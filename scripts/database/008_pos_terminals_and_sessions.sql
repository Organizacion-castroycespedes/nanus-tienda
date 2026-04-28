CREATE TABLE IF NOT EXISTS public.terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  device_fingerprint text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terminals_tenant_branch_code_unique UNIQUE (tenant_id, branch_id, code)
);

CREATE TABLE IF NOT EXISTS public.pos_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_id uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  terminal_id uuid NOT NULL REFERENCES public.terminals(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_terminals_tenant ON public.terminals (tenant_id);
CREATE INDEX IF NOT EXISTS idx_terminals_branch ON public.terminals (branch_id);
CREATE INDEX IF NOT EXISTS idx_terminals_is_active ON public.terminals (is_active);

CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_auth_session ON public.pos_user_sessions (auth_session_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_tenant ON public.pos_user_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_user ON public.pos_user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_is_active ON public.pos_user_sessions (is_active);
CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_branch ON public.pos_user_sessions (branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_terminal ON public.pos_user_sessions (terminal_id);

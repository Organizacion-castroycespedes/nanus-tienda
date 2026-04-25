CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  documento_tipo TEXT NOT NULL,
  documento_numero TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  email_personal TEXT,
  cargo_nombre TEXT NOT NULL,
  cargo_descripcion TEXT,
  funciones_descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS persona_id UUID UNIQUE;

ALTER TABLE users
  ADD CONSTRAINT users_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS persona_tenant_branches (
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tenant_branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  es_principal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (persona_id, tenant_branch_id)
);

CREATE INDEX IF NOT EXISTS idx_personas_tenant_documento
  ON personas(tenant_id, documento_numero);

CREATE INDEX IF NOT EXISTS idx_personas_tenant_email
  ON personas(tenant_id, email_personal);

CREATE INDEX IF NOT EXISTS idx_persona_branches_tenant
  ON persona_tenant_branches(tenant_id);

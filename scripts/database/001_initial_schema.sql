BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.migrations_history (
  id bigserial PRIMARY KEY,
  version text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  checksum text,
  success boolean NOT NULL DEFAULT true,
  details text
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nombre text,
  config jsonb,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_iso2 char(2) NOT NULL UNIQUE,
  codigo_iso3 char(3) NOT NULL UNIQUE,
  nombre text NOT NULL,
  moneda text,
  simbolo_moneda text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pais_id uuid NOT NULL REFERENCES public.paises(id),
  codigo_dane char(2) NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departamentos_codigo_dane_unique UNIQUE (pais_id, codigo_dane)
);

CREATE TABLE IF NOT EXISTS public.municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  codigo_dane char(5) NOT NULL,
  nombre text NOT NULL,
  es_capital boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipios_codigo_dane_unique UNIQUE (departamento_id, codigo_dane)
);

CREATE TABLE IF NOT EXISTS public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  documento_tipo text NOT NULL,
  documento_numero text NOT NULL,
  telefono text,
  direccion text,
  email_personal text,
  cargo_nombre text NOT NULL,
  cargo_descripcion text,
  funciones_descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personas_tenant_documento_unique UNIQUE (tenant_id, documento_numero)
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  persona_id uuid UNIQUE REFERENCES public.personas(id) ON DELETE SET NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  estado text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email),
  CONSTRAINT users_estado_check CHECK (estado IN ('ACTIVE', 'INACTIVE', 'BLOCKED'))
);

CREATE TABLE IF NOT EXISTS public.tenant_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  es_principal boolean NOT NULL DEFAULT false,
  direccion text,
  ciudad text,
  departamento text,
  pais text,
  telefono text,
  email text,
  estado text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  pais_id uuid REFERENCES public.paises(id),
  departamento_id uuid REFERENCES public.departamentos(id),
  municipio_id uuid REFERENCES public.municipios(id),
  CONSTRAINT tenant_branches_tenant_codigo_unique UNIQUE (tenant_id, codigo),
  CONSTRAINT tenant_branches_estado_check CHECK (estado IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS public.persona_tenant_branches (
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  tenant_branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  es_principal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, tenant_branch_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module text NOT NULL,
  route text NOT NULL,
  label text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  module text NOT NULL,
  label text NOT NULL,
  route text NOT NULL,
  icon text,
  parent_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  below_main_menu boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.role_menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  access_level text NOT NULL CHECK (access_level IN ('READ', 'WRITE')),
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  tenant_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  usuario_id uuid,
  modulo varchar(100) NOT NULL,
  entidad varchar(100) NOT NULL,
  entidad_id varchar(50) NOT NULL,
  accion varchar(50) NOT NULL,
  datos_antes jsonb,
  datos_despues jsonb,
  ip_origen inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  user_agent text,
  ip_address text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  user_agent text,
  ip_address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  razon_social text NOT NULL,
  nit text NOT NULL,
  dv text,
  tipo_persona text NOT NULL,
  tipo_sociedad text,
  fecha_constitucion date,
  estado text NOT NULL DEFAULT 'Activa',
  responsabilidades_dian text,
  regimen text,
  actividad_economica text,
  obligado_facturacion_electronica boolean NOT NULL DEFAULT false,
  resolucion_dian text,
  fecha_inicio_facturacion date,
  direccion_principal text,
  ciudad text,
  departamento text,
  pais text NOT NULL DEFAULT 'Colombia',
  telefono text,
  email_corporativo text,
  sitio_web text,
  representante_nombre text,
  representante_tipo_documento text,
  representante_numero_documento text,
  representante_email text,
  representante_telefono text,
  cuenta_contable_defecto text,
  banco_principal text,
  numero_cuenta text,
  tipo_cuenta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  pais_id uuid REFERENCES public.paises(id),
  departamento_id uuid REFERENCES public.departamentos(id),
  municipio_id uuid REFERENCES public.municipios(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_nombre ON public.roles (nombre);
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_role_tenant_module_route ON public.permissions (role_id, tenant_id, module, route);
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_key_unique ON public.menu_items (tenant_id, key) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_route_unique ON public.menu_items (tenant_id, route) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_menu_permissions_unique ON public.role_menu_permissions (tenant_id, role_id, menu_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_branches_principal ON public.tenant_branches (tenant_id) WHERE es_principal = true;

CREATE INDEX IF NOT EXISTS idx_personas_tenant_documento ON public.personas (tenant_id, documento_numero);
CREATE INDEX IF NOT EXISTS idx_personas_tenant_email ON public.personas (tenant_id, email_personal);
CREATE INDEX IF NOT EXISTS idx_persona_branches_tenant ON public.persona_tenant_branches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_tenant ON public.tenant_branches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_estado ON public.tenant_branches (estado);
CREATE INDEX IF NOT EXISTS idx_departamentos_pais ON public.departamentos (pais_id);
CREATE INDEX IF NOT EXISTS idx_municipios_departamento ON public.municipios (departamento_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON public.auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_tenant ON public.auth_refresh_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires ON public.auth_refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked ON public.auth_refresh_tokens (revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON public.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant ON public.auth_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token ON public.auth_sessions (refresh_token);
CREATE INDEX IF NOT EXISTS menu_items_parent_sort_idx ON public.menu_items (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS menu_items_tenant_idx ON public.menu_items (tenant_id);
CREATE INDEX IF NOT EXISTS role_menu_permissions_role_idx ON public.role_menu_permissions (tenant_id, role_id);
CREATE INDEX IF NOT EXISTS role_menu_permissions_menu_idx ON public.role_menu_permissions (tenant_id, menu_item_id);
CREATE INDEX IF NOT EXISTS security_audit_logs_tenant_idx ON public.security_audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_eventos_modulo_idx ON public.auditoria_eventos (modulo, entidad, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_eventos_tenant_idx ON public.auditoria_eventos (tenant_id, created_at DESC);

COMMIT;

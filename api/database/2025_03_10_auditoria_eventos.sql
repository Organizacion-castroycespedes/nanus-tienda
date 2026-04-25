CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  usuario_id UUID NULL,
  modulo VARCHAR(100) NOT NULL,
  entidad VARCHAR(100) NOT NULL,
  entidad_id VARCHAR(50) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  datos_antes JSONB,
  datos_despues JSONB,
  ip_origen INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_eventos_tenant_idx
  ON auditoria_eventos (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auditoria_eventos_modulo_idx
  ON auditoria_eventos (modulo, entidad, created_at DESC);

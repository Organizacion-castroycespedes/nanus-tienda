-- ==============================================================================
-- Migración: Soporte Completo para Métodos de Pago y Entidades Financieras (Bancos/Billeteras)
-- Fecha: 2026-09-22
-- ==============================================================================

-- 1. Extender tabla payment_methods de forma segura y no disruptiva
ALTER TABLE IF EXISTS payment_methods
  ADD COLUMN IF NOT EXISTS icon VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requires_financial_institution BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 2. Crear tabla financial_institutions
CREATE TABLE IF NOT EXISTS financial_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  nombre_corto VARCHAR(50),
  tipo VARCHAR(50) NOT NULL DEFAULT 'BANK',
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para busqueda y unicidad por tenant
CREATE INDEX IF NOT EXISTS idx_financial_institutions_tenant ON financial_institutions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_institutions_active ON financial_institutions(tenant_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_institutions_code_tenant 
  ON financial_institutions(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), codigo);

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS financial_institution_id UUID
    REFERENCES financial_institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_financial_institution
  ON payments(financial_institution_id);

-- 3. Crear tabla asociativa payment_method_financial_institutions
CREATE TABLE IF NOT EXISTS payment_method_financial_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  financial_institution_id UUID NOT NULL REFERENCES financial_institutions(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pm_fi_unique UNIQUE (tenant_id, payment_method_id, financial_institution_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_fi_pm_id ON payment_method_financial_institutions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_pm_fi_fi_id ON payment_method_financial_institutions(financial_institution_id);

-- 4. Semilla de Entidades Financieras estándar (Colombia) con logos vectoriales en Base64
INSERT INTO financial_institutions (tenant_id, codigo, nombre, nombre_corto, tipo, logo_url, active, sort_order)
VALUES
  (NULL, 'BANCOLOMBIA', 'Bancolombia S.A.', 'Bancolombia', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDAwMDAwIi8+PHBhdGggZD0iTTIyIDY2IEMyMCA0MCA0MCAyMiA2MiAyMiBDNzQgMjIgODAgMjggNzggMzYgQzc0IDQ0IDU4IDQ4IDQyIDUwIEMyNiA1MiAyMCA2MCAyMiA2NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkREQTI0IiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik02MiAyMiBDNzQgMjIgODAgMjggNzggMzYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwQzFENSIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3OCIgY3k9IjM2IiByPSI0LjUiIGZpbGw9IiNFMzFDNzkiLz48L3N2Zz4=', TRUE, 1),
  (NULL, 'NEQUI', 'Nequi', 'Nequi', 'WALLET', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMUYwMzI2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjIsIDIyKSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjU2IiByeD0iNCIgZmlsbD0iI0ZGMDA3QSIvPjxyZWN0IHg9IjQyIiB5PSIwIiB3aWR0aD0iMTQiIGhlaWdodD0iNTYiIHJ4PSI0IiBmaWxsPSIjRkYwMDdBIi8+PHBhdGggZD0iTTEyIDEyIEw0NCA0NCIgc3Ryb2tlPSIjMDBGRkYwIiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI0OSIgY3k9IjciIHI9IjUiIGZpbGw9IiMwMEZGRjAiLz48L2c+PC9zdmc+', TRUE, 2),
  (NULL, 'DAVIPLATA', 'Daviplata', 'Daviplata', 'WALLET', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjRUQxQzI0Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTgsIDE4KSI+PGNpcmNsZSBjeD0iMzIiIGN5PSIyMCIgcj0iMTAiIGZpbGw9IiNGRkZGRkYiLz48cGF0aCBkPSJNMTAgNTAgQzEwIDMyIDI0IDI0IDM4IDM0IEM0OCA0MiA1NiA0NiA1NCA1NCBDNTIgNjAgNDAgNjAgMzIgNTYgWiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0zOCAzNCBDNDggMjQgNTggMjYgNTYgMzYgQzU0IDQ0IDQ2IDQ2IDM4IDQ0IFoiIGZpbGw9IiNGRkREMDAiLz48L2c+PC9zdmc+', TRUE, 3),
  (NULL, 'DAVIVIENDA', 'Banco Davivienda S.A.', 'Davivienda', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjRUQxQzI0Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTgsIDIwKSI+PHJlY3QgeD0iOCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxNiIgZmlsbD0iI0ZGRkZGRiIgcng9IjEiLz48cG9seWdvbiBwb2ludHM9IjMyLDQgNjQsMzIgMCwzMiIgZmlsbD0iI0ZGRkZGRiIvPjxyZWN0IHg9IjYiIHk9IjMyIiB3aWR0aD0iNTIiIGhlaWdodD0iMzQiIGZpbGw9IiNGRkZGRkYiIHJ4PSIxIi8+PHJlY3QgeD0iMjQiIHk9IjQ0IiB3aWR0aD0iMTYiIGhlaWdodD0iMjIiIHJ4PSIzIiBmaWxsPSIjRUQxQzI0Ii8+PC9nPjwvc3ZnPg==', TRUE, 4),
  (NULL, 'BANCO_BOGOTA', 'Banco de Bogotá', 'Banco de Bogotá', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDAyRDcyIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMzIiIGZpbGw9IiNGOEIxMDAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIyMiIgZmlsbD0iIzAwMkQ3MiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEyIiBmaWxsPSIjRjhCMTAwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNSIgZmlsbD0iIzAwMkQ3MiIvPjwvc3ZnPg==', TRUE, 5),
  (NULL, 'BBVA', 'BBVA Colombia', 'BBVA', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDA0NDgxIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTAsIDMyKSI+PHRleHQgeD0iNDAiIHk9IjI4IiBmaWxsPSIjRkZGRkZGIiBmb250LXNpemU9IjI1IiBmb250LXdlaWdodD0iOTAwIiBmb250LWZhbWlseT0iJ1NlZ29lIFVJJywgQXJpYWwsIHNhbnMtc2VyaWYiIGxldHRlci1zcGFjaW5nPSIxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5CQlZBPC90ZXh0PjwvZz48L3N2Zz4=', TRUE, 6),
  (NULL, 'BANCO_POPULAR', 'Banco Popular', 'Banco Popular', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDA3QTMzIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjQsIDIyKSI+PHBhdGggZD0iTTAgMCBIMjggQzQyIDAgNDggMTAgNDggMjIgQzQ4IDM0IDQwIDQ0IDI2IDQ0IEgxNCBWNTggSDAgWiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xNCAxMiBIMjYgQzMyIDEyIDM0IDE2IDM0IDIyIEMzNCAyOCAzMiAzMiAyNiAzMiBIMTQgWiIgZmlsbD0iIzAwN0EzMyIvPjxjaXJjbGUgY3g9IjI2IiBjeT0iMjIiIHI9IjUiIGZpbGw9IiNGRkM3MkMiLz48L2c+PC9zdmc+', TRUE, 7),
  (NULL, 'BANCO_AV_VILLAS', 'Banco AV Villas', 'Banco AV Villas', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDA1MjlCIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjAsIDIwKSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwQTNFMCIgc3Ryb2tlLXdpZHRoPSI2Ii8+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0UzMUIyMyIgc3Ryb2tlLXdpZHRoPSI1Ii8+PHRleHQgeD0iMzAiIHk9IjM3IiBmaWxsPSIjRkZGRkZGIiBmb250LXNpemU9IjIwIiBmb250LXdlaWdodD0iOTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFWPC90ZXh0PjwvZz48L3N2Zz4=', TRUE, 8),
  (NULL, 'SCOTIABANK_COLPATRIA', 'Scotiabank Colpatria', 'Scotiabank', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjRUMxMTFBIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjQsIDIwKSI+PHBhdGggZD0iTTQyIDEyIEMzOCA0IDI4IDAgMTggNCBDOCA4IDIgMTggNCAyOCBDNiAzOCAxOCA0NCAyOCA0OCBDMzggNTIgNDYgNTYgNDYgNjQgQzQ2IDcyIDM4IDc4IDI2IDc2IEMxNCA3NCA2IDY0IDYgNjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L2c+PC9zdmc+', TRUE, 9),
  (NULL, 'ITAU', 'Banco Itaú Colombia', 'Itaú', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjRUM2NjA4Ii8+PHJlY3QgeD0iMTgiIHk9IjE4IiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNiIgZmlsbD0iIzAwMzNBMCIvPjx0ZXh0IHg9IjUwIiB5PSI1OCIgZmlsbD0iI0ZFRDEwMCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1mYW1pbHk9IidTZWdvZSBVSScsIEFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5pdGHDujwvdGV4dD48L3N2Zz4=', TRUE, 10),
  (NULL, 'BANCO_AGRARIO', 'Banco Agrario de Colombia', 'Banco Agrario', 'BANK', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMDA1OTI4Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjUsIDIwKSI+PHBhdGggZD0iTTI1IDYwIEMyNSAzNSA0OCAxMCA0OCAxMCBDNDggMTAgNTAgMzUgMzIgNTAgQzI2IDU1IDI1IDYwIDI1IDYwIFoiIGZpbGw9IiNGRUQxMDAiLz48cGF0aCBkPSJNMjUgNjAgQzI1IDQwIDYgMjUgNiAyNSBDNiAyNSA0IDQ1IDE4IDU0IEMyMiA1NyAyNSA2MCAyNSA2MCBaIiBmaWxsPSIjRkZGRkZGIi8+PGNpcmNsZSBjeD0iMjUiIGN5PSI1OCIgcj0iNCIgZmlsbD0iI0ZFRDEwMCIvPjwvZz48L3N2Zz4=', TRUE, 11),
  (NULL, 'OTRO_BANCO', 'Otro banco o entidad', 'Otro...', 'OTHER', 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMzM0MTU1Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjUsIDI1KSIgZmlsbD0iI0ZGRkZGRiI+PHBvbHlnb24gcG9pbnRzPSIyNSw0IDQ2LDE2IDQsMTYiLz48cmVjdCB4PSI2IiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iMTgiLz48cmVjdCB4PSIxOCIgeT0iMjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjE4Ii8+PHJlY3QgeD0iMzAiIHk9IjIwIiB3aWR0aD0iNiIgaGVpZ2h0PSIxOCIvPjxyZWN0IHg9IjQyIiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iMTgiLz48cmVjdCB4PSIyIiB5PSI0MCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjYiIHJ4PSIyIi8+PC9nPjwvc3ZnPg==', TRUE, 12)
ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), codigo) 
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  nombre_corto = EXCLUDED.nombre_corto,
  tipo = EXCLUDED.tipo,
  logo_url = EXCLUDED.logo_url,
  sort_order = EXCLUDED.sort_order;

-- Los logos anteriores eran SVG generados y no representaban las marcas reales.
-- El frontend usa un renderer canonico por codigo; se conserva logo_url solo para
-- assets externos administrados por el tenant.
UPDATE financial_institutions
SET logo_url = NULL,
    updated_at = NOW()
WHERE logo_url LIKE 'data:image/svg+xml;base64,%';

-- QR Bre-B: medio digital idempotente para todos los tenants existentes.
-- Bre-B usa QR o llave; la confirmacion bancaria sigue siendo responsabilidad del operador.
INSERT INTO payment_methods (
  tenant_id, codigo, nombre, tipo, requires_reference,
  requires_financial_institution, icon, color, sort_order,
  allows_change, active
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
  TRUE
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM payment_methods pm
  WHERE pm.tenant_id = t.id AND UPPER(pm.codigo) = 'QR_BREB'
);

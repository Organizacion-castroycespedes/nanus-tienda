BEGIN;

-- Catalogo operativo de repartidores para domicilios.
-- Aditivo: no borra datos, no modifica caja, pagos, POS, inventario ni fiscal.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  IF to_regclass('public.deliveries') IS NULL THEN
    RAISE EXCEPTION 'Required table public.deliveries does not exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  phone text NULL,
  document_number text NULL,
  active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_delivery_drivers_tenant'
      AND conrelid = 'public.delivery_drivers'::regclass
  ) THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT fk_delivery_drivers_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_drivers_name_not_blank'
      AND conrelid = 'public.delivery_drivers'::regclass
  ) THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT chk_delivery_drivers_name_not_blank
      CHECK (btrim(name) <> '');
  END IF;
END $$;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS driver_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_driver'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_driver
      FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_tenant_active_name
  ON public.delivery_drivers (tenant_id, active, lower(name));

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_tenant_document
  ON public.delivery_drivers (tenant_id, document_number);

CREATE INDEX IF NOT EXISTS idx_deliveries_driver
  ON public.deliveries (driver_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_driver
  ON public.deliveries (tenant_id, driver_id);

COMMIT;

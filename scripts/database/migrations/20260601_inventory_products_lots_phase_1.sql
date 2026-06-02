BEGIN;

-- Phase 2.1: productos enriquecidos, barcodes, lotes, ubicaciones,
-- saldos por lote, historial de precios y alertas.
-- Seguro para PostgreSQL 16. No activa reglas funcionales ni modifica funciones POS.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Required table public.products does not exist';
  END IF;

  IF to_regclass('public.stock_movements') IS NULL THEN
    RAISE EXCEPTION 'Required table public.stock_movements does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS is_perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_lot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_expiration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS rotation_class text,
  ADD COLUMN IF NOT EXISTS min_stock numeric(14, 2),
  ADD COLUMN IF NOT EXISTS max_stock numeric(14, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_operational_status'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_operational_status
      CHECK (operational_status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DISCONTINUED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_rotation_class'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_rotation_class
      CHECK (rotation_class IS NULL OR rotation_class IN ('HIGH', 'MEDIUM', 'LOW', 'NO_MOVEMENT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_min_stock_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_min_stock_non_negative
      CHECK (min_stock IS NULL OR min_stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_max_stock_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_max_stock_non_negative
      CHECK (max_stock IS NULL OR max_stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_stock_range'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_stock_range
      CHECK (max_stock IS NULL OR min_stock IS NULL OR max_stock >= min_stock);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_expiration_requires_lot'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_expiration_requires_lot
      CHECK (requires_expiration = false OR requires_lot = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_perishable_has_control'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_perishable_has_control
      CHECK (is_perishable = false OR requires_expiration = true OR requires_lot = true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_tenant_operational_status
  ON public.products (tenant_id, operational_status);

CREATE INDEX IF NOT EXISTS idx_products_tenant_rotation_class
  ON public.products (tenant_id, rotation_class)
  WHERE rotation_class IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  barcode text NOT NULL,
  barcode_type text NOT NULL DEFAULT 'UNIT',
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'OTHER',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  supplier_id uuid,
  purchase_id uuid,
  purchase_item_id uuid,
  lot_code text NOT NULL,
  expiration_date date,
  received_at timestamptz NOT NULL DEFAULT now(),
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  is_legacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_lot_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  location_id uuid,
  quantity_on_hand numeric(14, 2) NOT NULL DEFAULT 0,
  quantity_reserved numeric(14, 2) NOT NULL DEFAULT 0,
  quantity_available numeric(14, 2)
    GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movement_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stock_movement_id uuid NOT NULL,
  product_id uuid NOT NULL,
  lot_id uuid,
  location_id uuid,
  quantity numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  previous_price numeric(14, 2) NOT NULL,
  new_price numeric(14, 2) NOT NULL,
  reason text NOT NULL,
  changed_by uuid,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  status text NOT NULL DEFAULT 'APPLIED',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  alert_type text NOT NULL,
  threshold_days integer,
  threshold_quantity numeric(14, 2),
  severity text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid,
  product_id uuid NOT NULL,
  lot_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  message text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- TODO: Reusar trigger de updated_at si se formaliza un patron global.
-- En esta migracion no se crea funcion trigger global nueva.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_barcodes_barcode_non_empty'
      AND conrelid = 'public.product_barcodes'::regclass
  ) THEN
    ALTER TABLE public.product_barcodes
      ADD CONSTRAINT chk_product_barcodes_barcode_non_empty
      CHECK (length(trim(barcode)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_barcodes_type'
      AND conrelid = 'public.product_barcodes'::regclass
  ) THEN
    ALTER TABLE public.product_barcodes
      ADD CONSTRAINT chk_product_barcodes_type
      CHECK (barcode_type IN ('UNIT', 'PACKAGE', 'BOX', 'SUPPLIER', 'INTERNAL', 'OTHER'));
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_product_barcodes_tenant'
         AND conrelid = 'public.product_barcodes'::regclass
     ) THEN
    ALTER TABLE public.product_barcodes
      ADD CONSTRAINT fk_product_barcodes_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_product_barcodes_product'
      AND conrelid = 'public.product_barcodes'::regclass
  ) THEN
    ALTER TABLE public.product_barcodes
      ADD CONSTRAINT fk_product_barcodes_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_barcodes_tenant_barcode
  ON public.product_barcodes (tenant_id, barcode);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_barcodes_primary_active
  ON public.product_barcodes (tenant_id, product_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_barcodes_tenant_product
  ON public.product_barcodes (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_active_lookup
  ON public.product_barcodes (tenant_id, barcode)
  WHERE is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_locations_code_non_empty'
      AND conrelid = 'public.inventory_locations'::regclass
  ) THEN
    ALTER TABLE public.inventory_locations
      ADD CONSTRAINT chk_inventory_locations_code_non_empty
      CHECK (length(trim(code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_locations_name_non_empty'
      AND conrelid = 'public.inventory_locations'::regclass
  ) THEN
    ALTER TABLE public.inventory_locations
      ADD CONSTRAINT chk_inventory_locations_name_non_empty
      CHECK (length(trim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_locations_type'
      AND conrelid = 'public.inventory_locations'::regclass
  ) THEN
    ALTER TABLE public.inventory_locations
      ADD CONSTRAINT chk_inventory_locations_type
      CHECK (type IN ('WAREHOUSE', 'DISPLAY', 'SHELF', 'COLD_ROOM', 'COUNTER', 'OTHER'));
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_locations_tenant'
         AND conrelid = 'public.inventory_locations'::regclass
     ) THEN
    ALTER TABLE public.inventory_locations
      ADD CONSTRAINT fk_inventory_locations_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenant_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_locations_branch'
         AND conrelid = 'public.inventory_locations'::regclass
     ) THEN
    ALTER TABLE public.inventory_locations
      ADD CONSTRAINT fk_inventory_locations_branch
      FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_locations_tenant_branch_code
  ON public.inventory_locations (tenant_id, branch_id, code);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_tenant_branch
  ON public.inventory_locations (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_tenant_branch_active
  ON public.inventory_locations (tenant_id, branch_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lots_code_non_empty'
      AND conrelid = 'public.inventory_lots'::regclass
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT chk_inventory_lots_code_non_empty
      CHECK (length(trim(lot_code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lots_status'
      AND conrelid = 'public.inventory_lots'::regclass
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT chk_inventory_lots_status
      CHECK (status IN ('ACTIVE', 'EXPIRED', 'BLOCKED', 'CONSUMED', 'CANCELLED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lots_unit_cost_non_negative'
      AND conrelid = 'public.inventory_lots'::regclass
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT chk_inventory_lots_unit_cost_non_negative
      CHECK (unit_cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lots_expiration_floor'
      AND conrelid = 'public.inventory_lots'::regclass
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT chk_inventory_lots_expiration_floor
      CHECK (expiration_date IS NULL OR expiration_date >= DATE '2000-01-01');
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lots_tenant'
         AND conrelid = 'public.inventory_lots'::regclass
     ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenant_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lots_branch'
         AND conrelid = 'public.inventory_lots'::regclass
     ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_branch
      FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_lots_product'
      AND conrelid = 'public.inventory_lots'::regclass
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('public.suppliers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lots_supplier'
         AND conrelid = 'public.inventory_lots'::regclass
     ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.purchases') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lots_purchase'
         AND conrelid = 'public.inventory_lots'::regclass
     ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_purchase
      FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.purchase_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lots_purchase_item'
         AND conrelid = 'public.inventory_lots'::regclass
     ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT fk_inventory_lots_purchase_item
      FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_lots_tenant_branch_product_code
  ON public.inventory_lots (tenant_id, branch_id, product_id, lot_code);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fefo
  ON public.inventory_lots (tenant_id, branch_id, product_id, expiration_date ASC, received_at ASC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_inventory_lots_active
  ON public.inventory_lots (tenant_id, branch_id, product_id, status)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_inventory_lots_purchase_item
  ON public.inventory_lots (purchase_item_id)
  WHERE purchase_item_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lot_balances_on_hand_non_negative'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT chk_inventory_lot_balances_on_hand_non_negative
      CHECK (quantity_on_hand >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lot_balances_reserved_non_negative'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT chk_inventory_lot_balances_reserved_non_negative
      CHECK (quantity_reserved >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_lot_balances_reserved_lte_on_hand'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT chk_inventory_lot_balances_reserved_lte_on_hand
      CHECK (quantity_reserved <= quantity_on_hand);
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lot_balances_tenant'
         AND conrelid = 'public.inventory_lot_balances'::regclass
     ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT fk_inventory_lot_balances_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenant_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_lot_balances_branch'
         AND conrelid = 'public.inventory_lot_balances'::regclass
     ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT fk_inventory_lot_balances_branch
      FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_lot_balances_product'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT fk_inventory_lot_balances_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_lot_balances_lot'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT fk_inventory_lot_balances_lot
      FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_lot_balances_location'
      AND conrelid = 'public.inventory_lot_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_lot_balances
      ADD CONSTRAINT fk_inventory_lot_balances_location
      FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_lot_balances_without_location
  ON public.inventory_lot_balances (tenant_id, branch_id, product_id, lot_id)
  WHERE location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_lot_balances_with_location
  ON public.inventory_lot_balances (tenant_id, branch_id, product_id, lot_id, location_id)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_lot_balances_tenant_branch_product
  ON public.inventory_lot_balances (tenant_id, branch_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lot_balances_available_fefo
  ON public.inventory_lot_balances (tenant_id, branch_id, product_id, lot_id)
  WHERE quantity_available > 0;

CREATE INDEX IF NOT EXISTS idx_inventory_lot_balances_location
  ON public.inventory_lot_balances (tenant_id, branch_id, location_id)
  WHERE location_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_stock_movement_lots_quantity_positive'
      AND conrelid = 'public.stock_movement_lots'::regclass
  ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT chk_stock_movement_lots_quantity_positive
      CHECK (quantity > 0);
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_stock_movement_lots_tenant'
         AND conrelid = 'public.stock_movement_lots'::regclass
     ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT fk_stock_movement_lots_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_stock_movement_lots_movement'
      AND conrelid = 'public.stock_movement_lots'::regclass
  ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT fk_stock_movement_lots_movement
      FOREIGN KEY (stock_movement_id) REFERENCES public.stock_movements(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_stock_movement_lots_product'
      AND conrelid = 'public.stock_movement_lots'::regclass
  ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT fk_stock_movement_lots_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_stock_movement_lots_lot'
      AND conrelid = 'public.stock_movement_lots'::regclass
  ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT fk_stock_movement_lots_lot
      FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_stock_movement_lots_location'
      AND conrelid = 'public.stock_movement_lots'::regclass
  ) THEN
    ALTER TABLE public.stock_movement_lots
      ADD CONSTRAINT fk_stock_movement_lots_location
      FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movement_lots_tenant_movement
  ON public.stock_movement_lots (tenant_id, stock_movement_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_lots_tenant_product_lot
  ON public.stock_movement_lots (tenant_id, product_id, lot_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_lots_lot
  ON public.stock_movement_lots (lot_id)
  WHERE lot_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_price_history_previous_non_negative'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT chk_product_price_history_previous_non_negative
      CHECK (previous_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_price_history_new_non_negative'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT chk_product_price_history_new_non_negative
      CHECK (new_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_price_history_reason_length'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT chk_product_price_history_reason_length
      CHECK (length(trim(reason)) >= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_price_history_valid_range'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT chk_product_price_history_valid_range
      CHECK (valid_to IS NULL OR valid_to > valid_from);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_product_price_history_status'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT chk_product_price_history_status
      CHECK (status IN ('APPLIED', 'PENDING_APPROVAL', 'REJECTED'));
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_product_price_history_tenant'
         AND conrelid = 'public.product_price_history'::regclass
     ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT fk_product_price_history_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_product_price_history_product'
      AND conrelid = 'public.product_price_history'::regclass
  ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT fk_product_price_history_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_product_price_history_changed_by'
         AND conrelid = 'public.product_price_history'::regclass
     ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT fk_product_price_history_changed_by
      FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_product_price_history_approved_by'
         AND conrelid = 'public.product_price_history'::regclass
     ) THEN
    ALTER TABLE public.product_price_history
      ADD CONSTRAINT fk_product_price_history_approved_by
      FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_price_history_tenant_product_valid_from
  ON public.product_price_history (tenant_id, product_id, valid_from DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_price_history_current_applied
  ON public.product_price_history (tenant_id, product_id)
  WHERE status = 'APPLIED' AND valid_to IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alert_rules_type'
      AND conrelid = 'public.inventory_alert_rules'::regclass
  ) THEN
    ALTER TABLE public.inventory_alert_rules
      ADD CONSTRAINT chk_inventory_alert_rules_type
      CHECK (alert_type IN ('EXPIRING_SOON', 'EXPIRED', 'LOW_STOCK', 'OUT_OF_STOCK', 'LOW_ROTATION', 'NO_MOVEMENT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alert_rules_severity'
      AND conrelid = 'public.inventory_alert_rules'::regclass
  ) THEN
    ALTER TABLE public.inventory_alert_rules
      ADD CONSTRAINT chk_inventory_alert_rules_severity
      CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alert_rules_threshold_days'
      AND conrelid = 'public.inventory_alert_rules'::regclass
  ) THEN
    ALTER TABLE public.inventory_alert_rules
      ADD CONSTRAINT chk_inventory_alert_rules_threshold_days
      CHECK (threshold_days IS NULL OR threshold_days >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alert_rules_threshold_quantity'
      AND conrelid = 'public.inventory_alert_rules'::regclass
  ) THEN
    ALTER TABLE public.inventory_alert_rules
      ADD CONSTRAINT chk_inventory_alert_rules_threshold_quantity
      CHECK (threshold_quantity IS NULL OR threshold_quantity >= 0);
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_alert_rules_tenant'
         AND conrelid = 'public.inventory_alert_rules'::regclass
     ) THEN
    ALTER TABLE public.inventory_alert_rules
      ADD CONSTRAINT fk_inventory_alert_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_alert_rules_tenant_type_severity
  ON public.inventory_alert_rules (tenant_id, alert_type, severity);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_rules_tenant_active
  ON public.inventory_alert_rules (tenant_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alerts_type'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT chk_inventory_alerts_type
      CHECK (alert_type IN ('EXPIRING_SOON', 'EXPIRED', 'LOW_STOCK', 'OUT_OF_STOCK', 'LOW_ROTATION', 'NO_MOVEMENT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alerts_severity'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT chk_inventory_alerts_severity
      CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alerts_status'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT chk_inventory_alerts_status
      CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alerts_message_non_empty'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT chk_inventory_alerts_message_non_empty
      CHECK (length(trim(message)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_alerts_resolved_after_detected'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT chk_inventory_alerts_resolved_after_detected
      CHECK (resolved_at IS NULL OR resolved_at >= detected_at);
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_alerts_tenant'
         AND conrelid = 'public.inventory_alerts'::regclass
     ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT fk_inventory_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenant_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inventory_alerts_branch'
         AND conrelid = 'public.inventory_alerts'::regclass
     ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT fk_inventory_alerts_branch
      FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_alerts_product'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT fk_inventory_alerts_product
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_alerts_lot'
      AND conrelid = 'public.inventory_alerts'::regclass
  ) THEN
    ALTER TABLE public.inventory_alerts
      ADD CONSTRAINT fk_inventory_alerts_lot
      FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_tenant_status_severity
  ON public.inventory_alerts (tenant_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_tenant_product
  ON public.inventory_alerts (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_tenant_branch
  ON public.inventory_alerts (tenant_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMIT;

BEGIN;

-- Fase 4: base real del modulo de domicilios.
-- SQL DDL directo. No usa Prisma ni ORM.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  IF to_regclass('public.tenant_branches') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenant_branches does not exist';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Required table public.users does not exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  customer_id uuid NULL,
  order_id uuid NULL,
  sale_id uuid NULL,
  delivery_number varchar(50) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'CREATED',
  customer_name varchar(160) NULL,
  customer_phone varchar(40) NULL,
  delivery_address text NOT NULL,
  delivery_reference text NULL,
  delivery_fee numeric(14, 2) NOT NULL DEFAULT 0,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  payment_method_id uuid NULL,
  assigned_courier_id uuid NULL,
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NULL,
  updated_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  delivered_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  previous_status varchar(30) NULL,
  new_status varchar(30) NOT NULL,
  changed_by_user_id uuid NULL,
  reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_tenant'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_branch'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_branch
      FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('public.customers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_deliveries_customer'
        AND conrelid = 'public.deliveries'::regclass
    ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_customer
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_deliveries_order'
        AND conrelid = 'public.deliveries'::regclass
    ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_order
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.sales') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_deliveries_sale'
        AND conrelid = 'public.deliveries'::regclass
    ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_sale
      FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.payment_methods') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_deliveries_payment_method'
        AND conrelid = 'public.deliveries'::regclass
    ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_payment_method
      FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_assigned_courier'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_assigned_courier
      FOREIGN KEY (assigned_courier_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_created_by_user'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_created_by_user
      FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_updated_by_user'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_updated_by_user
      FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_deliveries_tenant_branch_number'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT uq_deliveries_tenant_branch_number
      UNIQUE (tenant_id, branch_id, delivery_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_status'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_status
      CHECK (status IN (
        'DRAFT',
        'CREATED',
        'ASSIGNED',
        'DISPATCHED',
        'DELIVERED',
        'NOT_DELIVERED',
        'CANCELLED'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_delivery_fee_non_negative'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_delivery_fee_non_negative
      CHECK (delivery_fee >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_subtotal_non_negative'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_subtotal_non_negative
      CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_total_non_negative'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_total_non_negative
      CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_address_not_blank'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_address_not_blank
      CHECK (btrim(delivery_address) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_metadata_object'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_metadata_object
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_delivery_status_history_delivery'
      AND conrelid = 'public.delivery_status_history'::regclass
  ) THEN
    ALTER TABLE public.delivery_status_history
      ADD CONSTRAINT fk_delivery_status_history_delivery
      FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_delivery_status_history_changed_by_user'
      AND conrelid = 'public.delivery_status_history'::regclass
  ) THEN
    ALTER TABLE public.delivery_status_history
      ADD CONSTRAINT fk_delivery_status_history_changed_by_user
      FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_status_history_previous_status'
      AND conrelid = 'public.delivery_status_history'::regclass
  ) THEN
    ALTER TABLE public.delivery_status_history
      ADD CONSTRAINT chk_delivery_status_history_previous_status
      CHECK (
        previous_status IS NULL
        OR previous_status IN (
          'DRAFT',
          'CREATED',
          'ASSIGNED',
          'DISPATCHED',
          'DELIVERED',
          'NOT_DELIVERED',
          'CANCELLED'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_status_history_new_status'
      AND conrelid = 'public.delivery_status_history'::regclass
  ) THEN
    ALTER TABLE public.delivery_status_history
      ADD CONSTRAINT chk_delivery_status_history_new_status
      CHECK (new_status IN (
        'DRAFT',
        'CREATED',
        'ASSIGNED',
        'DISPATCHED',
        'DELIVERED',
        'NOT_DELIVERED',
        'CANCELLED'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_status_history_metadata_object'
      AND conrelid = 'public.delivery_status_history'::regclass
  ) THEN
    ALTER TABLE public.delivery_status_history
      ADD CONSTRAINT chk_delivery_status_history_metadata_object
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_branch_status
  ON public.deliveries (tenant_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_branch_created_at
  ON public.deliveries (tenant_id, branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_customer
  ON public.deliveries (customer_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_assigned_courier
  ON public.deliveries (assigned_courier_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_order
  ON public.deliveries (order_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_sale
  ON public.deliveries (sale_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
  ON public.deliveries (status);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery
  ON public.delivery_status_history (delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_created_at
  ON public.delivery_status_history (created_at DESC);

COMMIT;

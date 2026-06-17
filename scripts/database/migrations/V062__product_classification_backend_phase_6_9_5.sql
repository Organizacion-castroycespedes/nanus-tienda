BEGIN;

-- Fase 6.9.5: categorias/subcategorias de productos.
-- Base tenant-safe para clasificacion e imagenes. No implementa upload/storage.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Required table public.products does not exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name varchar(150) NOT NULL,
  slug varchar(180) NOT NULL,
  description text,
  default_image_url text,
  default_image_storage_key text,
  default_image_alt_text varchar(255),
  default_image_mime_type varchar(100),
  default_image_size_bytes bigint,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name varchar(150) NOT NULL,
  slug varchar(180) NOT NULL,
  description text,
  default_image_url text,
  default_image_storage_key text,
  default_image_alt_text varchar(255),
  default_image_mime_type varchar(100),
  default_image_size_bytes bigint,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_storage_key text,
  ADD COLUMN IF NOT EXISTS image_alt_text varchar(255),
  ADD COLUMN IF NOT EXISTS image_mime_type varchar(100),
  ADD COLUMN IF NOT EXISTS image_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS image_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_product_categories_tenant'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT fk_product_categories_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_categories_tenant_slug'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT uq_product_categories_tenant_slug UNIQUE (tenant_id, slug);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_categories_tenant_id'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT uq_product_categories_tenant_id UNIQUE (tenant_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_categories_default_image_mime_type'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT chk_product_categories_default_image_mime_type
      CHECK (
        default_image_mime_type IS NULL
        OR default_image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_categories_default_image_size_bytes'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT chk_product_categories_default_image_size_bytes
      CHECK (default_image_size_bytes IS NULL OR default_image_size_bytes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_categories_sort_order'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT chk_product_categories_sort_order
      CHECK (sort_order >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_product_subcategories_tenant'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT fk_product_subcategories_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_product_subcategories_category'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT fk_product_subcategories_category
      FOREIGN KEY (tenant_id, category_id)
      REFERENCES public.product_categories(tenant_id, id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_subcategories_tenant_category_slug'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT uq_product_subcategories_tenant_category_slug
      UNIQUE (tenant_id, category_id, slug);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_subcategories_tenant_id'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT uq_product_subcategories_tenant_id UNIQUE (tenant_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_subcategories_tenant_id_category'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT uq_product_subcategories_tenant_id_category
      UNIQUE (tenant_id, id, category_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_subcategories_default_image_mime_type'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT chk_product_subcategories_default_image_mime_type
      CHECK (
        default_image_mime_type IS NULL
        OR default_image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_subcategories_default_image_size_bytes'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT chk_product_subcategories_default_image_size_bytes
      CHECK (default_image_size_bytes IS NULL OR default_image_size_bytes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_subcategories_sort_order'
      AND conrelid = 'public.product_subcategories'::regclass
  ) THEN
    ALTER TABLE public.product_subcategories
      ADD CONSTRAINT chk_product_subcategories_sort_order
      CHECK (sort_order >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_products_category'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT fk_products_category
      FOREIGN KEY (tenant_id, category_id)
      REFERENCES public.product_categories(tenant_id, id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_products_subcategory'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT fk_products_subcategory
      FOREIGN KEY (tenant_id, subcategory_id)
      REFERENCES public.product_subcategories(tenant_id, id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_products_subcategory_category'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT fk_products_subcategory_category
      FOREIGN KEY (tenant_id, subcategory_id, category_id)
      REFERENCES public.product_subcategories(tenant_id, id, category_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_subcategory_requires_category'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_subcategory_requires_category
      CHECK (subcategory_id IS NULL OR category_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_image_mime_type'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_image_mime_type
      CHECK (
        image_mime_type IS NULL
        OR image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_image_size_bytes'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_image_size_bytes
      CHECK (image_size_bytes IS NULL OR image_size_bytes >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_active
  ON public.product_categories (tenant_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_product_subcategories_tenant_category_active
  ON public.product_subcategories (tenant_id, category_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_products_tenant_category_id
  ON public.products (tenant_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_subcategory_id
  ON public.products (tenant_id, subcategory_id)
  WHERE subcategory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_category_subcategory
  ON public.products (tenant_id, category_id, subcategory_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_has_image
  ON public.products (tenant_id, id)
  WHERE image_url IS NOT NULL;

COMMIT;

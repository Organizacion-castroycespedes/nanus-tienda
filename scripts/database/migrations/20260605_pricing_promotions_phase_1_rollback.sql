BEGIN;

-- Rollback conservador Fase 6.5.
-- ADVERTENCIA: elimina promociones y asociaciones creadas en esta fase.
-- No toca ventas, pedidos, POS ni productos base.

DROP INDEX IF EXISTS public.idx_promotion_branches_tenant_branch;
DROP INDEX IF EXISTS public.idx_promotion_products_tenant_product;
DROP INDEX IF EXISTS public.idx_promotions_tenant_search;
DROP INDEX IF EXISTS public.idx_promotions_tenant_active_dates;

DROP TABLE IF EXISTS public.promotion_branches;
DROP TABLE IF EXISTS public.promotion_products;
DROP TABLE IF EXISTS public.promotions;

COMMIT;

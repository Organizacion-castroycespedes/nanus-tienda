-- Rollback de V119__order_sale_void_serials.sql
-- Solo elimina la funcion; los eventos y estados ya registrados se conservan.
-- Revertir antes el codigo que la llama (OperationalSalesService, anulacion de ventas de pedido).
DROP FUNCTION IF EXISTS public.prc_product_serials_mark_returned_order_sale(UUID, UUID, UUID, JSONB, BOOLEAN, UUID, TEXT);

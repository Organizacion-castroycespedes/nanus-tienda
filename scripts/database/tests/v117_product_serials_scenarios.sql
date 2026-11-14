-- Escenarios funcionales de V117 sobre fixtures/v117_minimal_schema.sql + la migración.
-- Cada paso valida el resultado o el error SERIAL_* esperado; cualquier desvío aborta con ERROR.
\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION expect_error(p_sql text, p_message text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> p_message THEN
      RAISE EXCEPTION 'esperaba % y salio %', p_message, SQLERRM;
    END IF;
    RAISE NOTICE 'OK error %', p_message;
    RETURN;
  END;
  RAISE EXCEPTION 'esperaba error % y no hubo', p_message;
END $f$;
CREATE OR REPLACE FUNCTION ok(p_cond boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', p_label; END IF; RAISE NOTICE 'OK %', p_label; END $f$;
CREATE OR REPLACE FUNCTION sid(p text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM product_serials WHERE serial_number_normalized = p $f$;

-- Producto: reglas de la columna requires_serial
UPDATE products SET requires_serial = true WHERE id = '00000000-0000-0000-0000-0000000000f1'::uuid;
SELECT expect_error($q$UPDATE products SET requires_serial = true WHERE id = '00000000-0000-0000-0000-0000000000f3'::uuid$q$,
  'new row for relation "products" violates check constraint "chk_products_serial_rules"');
SELECT expect_error($q$UPDATE products SET sale_type = 'WEIGHT', measurement_unit = 'KG' WHERE id = '00000000-0000-0000-0000-0000000000f1'::uuid$q$,
  'new row for relation "products" violates check constraint "chk_products_serial_rules"');
SELECT expect_error($q$UPDATE products SET is_inventoryable = false WHERE id = '00000000-0000-0000-0000-0000000000f1'::uuid$q$,
  'new row for relation "products" violates check constraint "chk_products_serial_rules"');

-- Recepción de compra (5 unidades)
INSERT INTO purchases VALUES ('00000000-0000-0000-0000-000000000d01'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid);
INSERT INTO purchase_items VALUES ('00000000-0000-0000-0000-000000000d02'::uuid, '00000000-0000-0000-0000-000000000d01'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid);
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000d03'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'IN', 5, 'PURCHASE', '00000000-0000-0000-0000-000000000d01'::uuid, 'purchases');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,'["a1","a2","a3","a4"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_COUNT_MISMATCH');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,'["a1","A1 ","a3","a4","a5"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_DUPLICATE_IN_PAYLOAD');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,'["a1","a 2","a3","a4","a5"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_INVALID_FORMAT');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,'[]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_REQUIRED');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f2'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,NULL,'["x1"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_NOT_REQUIRED');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,'["a1","a2","a3","a4","a5"]','00000000-0000-0000-0000-0000000001a3'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_LOCATION_INVALID');
SELECT ok((SELECT count(*) FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'PURCHASE','00000000-0000-0000-0000-000000000d01'::uuid,'00000000-0000-0000-0000-000000000d02'::uuid,'00000000-0000-0000-0000-000000000d03'::uuid,
  '["lgac-0001",{"serial":"LGAC-0002","locationId":"00000000-0000-0000-0000-0000000001a2"},"LGAC-0003","LGAC-0004","LGAC-0005"]','00000000-0000-0000-0000-0000000001a1'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid)) = 5, 'recepcion de 5 series');
SELECT ok((SELECT count(*) FROM product_serials WHERE status = 'AVAILABLE' AND location_id = '00000000-0000-0000-0000-0000000001a1'::uuid) = 4
      AND (SELECT count(*) FROM product_serials WHERE location_id = '00000000-0000-0000-0000-0000000001a2'::uuid) = 1, 'ubicacion por linea y por serie');
SELECT ok((SELECT serial_number_normalized FROM product_serials WHERE serial_number = 'lgac-0001') = 'LGAC-0001', 'normalizacion a mayusculas');
SELECT ok((SELECT count(*) FROM product_serial_events WHERE event_type = 'RECEIVED' AND reference_id = '00000000-0000-0000-0000-000000000d01'::uuid) = 5, '5 eventos RECEIVED');
SELECT expect_error($q$SELECT * FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'ADJUSTMENT',NULL,NULL,NULL,'["LGAC-0003"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_DUPLICATE');
SELECT expect_error($q$UPDATE product_serial_events SET reason = 'x'$q$, 'SERIAL_EVENTS_IMMUTABLE');
SELECT expect_error($q$DELETE FROM product_serial_events$q$, 'SERIAL_EVENTS_IMMUTABLE');

-- Venta POS: item con serie (2 u) e item sin serie
INSERT INTO sales VALUES ('00000000-0000-0000-0000-000000000e01'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid);
INSERT INTO sale_items VALUES ('00000000-0000-0000-0000-000000000e02'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-000000000e01'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 2), ('00000000-0000-0000-0000-000000000e03'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-000000000e01'::uuid, '00000000-0000-0000-0000-0000000000f2'::uuid, 1);
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000e04'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'OUT', 2, 'SALE', '00000000-0000-0000-0000-000000000e01'::uuid, 'sales');
SELECT expect_error($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$, 'SERIAL_COUNT_MISMATCH');
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e02'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'))))), 'SERIAL_COUNT_MISMATCH');
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b2'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e02'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'), sid('LGAC-0002'))))), 'SERIAL_WRONG_BRANCH');
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(
    jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e03'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0003'))),
    jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e02'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'), sid('LGAC-0002'))))), 'SERIAL_NOT_REQUIRED');
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e02'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'), sid('LGAC-0001'))))), 'SERIAL_DUPLICATE_IN_PAYLOAD');
SELECT ok(fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,
  jsonb_build_array(jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e02'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'), sid('LGAC-0002')))), '00000000-0000-0000-0000-0000000000e1'::uuid) = 2, 'venta asigna 2 series');
SELECT ok((SELECT count(*) FROM product_serials WHERE status = 'SOLD' AND sale_id = '00000000-0000-0000-0000-000000000e01'::uuid AND customer_id = '00000000-0000-0000-0000-0000000000c1'::uuid AND out_stock_movement_id = '00000000-0000-0000-0000-000000000e04'::uuid) = 2, 'SOLD con venta, cliente y movimiento');
INSERT INTO sales VALUES ('00000000-0000-0000-0000-000000000e11'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid);
INSERT INTO sale_items VALUES ('00000000-0000-0000-0000-000000000e12'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-000000000e11'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 1);
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e11'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(jsonb_build_object('saleItemId', '00000000-0000-0000-0000-000000000e12'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0001'))))), 'SERIAL_NOT_AVAILABLE');
INSERT INTO sales VALUES ('00000000-0000-0000-0000-000000000e21'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid);
INSERT INTO sale_items VALUES ('00000000-0000-0000-0000-000000000e22'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-000000000e21'::uuid, '00000000-0000-0000-0000-0000000000f2'::uuid, 3);
SELECT ok(fnc_product_serials_assign_sale('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000e21'::uuid,NULL,'00000000-0000-0000-0000-0000000000e1'::uuid) = 0, 'venta sin series retorna 0');

-- Anulación (el servicio de venta ya revirtió el stock con un IN)
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000e05'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'IN', 2, 'SALE', '00000000-0000-0000-0000-000000000e01'::uuid, 'sales');
SELECT ok(prc_product_serials_mark_returned('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,false,'00000000-0000-0000-0000-0000000000e1'::uuid,'Nota credito') = 2, 'anulacion sin retorno registra evento');
SELECT ok(prc_product_serials_mark_returned('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,false,'00000000-0000-0000-0000-0000000000e1'::uuid,'Nota credito') = 0, 'sin retorno es idempotente');
SELECT ok((SELECT count(*) FROM product_serials WHERE sale_id = '00000000-0000-0000-0000-000000000e01'::uuid AND status = 'SOLD') = 2, 'sin retorno sigue SOLD');
SELECT ok(prc_product_serials_mark_returned('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,true,'00000000-0000-0000-0000-0000000000e1'::uuid,'Anulada') = 2, 'anulacion con retorno -> RETURNED');
SELECT ok(prc_product_serials_mark_returned('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000e01'::uuid,true,'00000000-0000-0000-0000-0000000000e1'::uuid,'Anulada') = 0, 'con retorno es idempotente');
SELECT ok(prc_product_serials_mark_returned('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000e21'::uuid,true,'00000000-0000-0000-0000-0000000000e1'::uuid,'Anulada') = 0, 'venta sin series no hace nada');

-- Inspección y bloqueo
SELECT expect_error(format($q$SELECT fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid,%L,'AVAILABLE','ok','00000000-0000-0000-0000-0000000000e1'::uuid,NULL)$q$, sid('LGAC-0001')), 'SERIAL_REASON_REQUIRED');
SELECT ok(fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid, sid('LGAC-0001'), 'AVAILABLE', 'Revisado, funciona', '00000000-0000-0000-0000-0000000000e1'::uuid, NULL) = 'AVAILABLE', 'RETURNED -> AVAILABLE');
SELECT expect_error(format($q$SELECT fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid,%L,'WRITTEN_OFF','Danado sin arreglo','00000000-0000-0000-0000-0000000000e1'::uuid,NULL)$q$, sid('LGAC-0002')), 'SERIAL_MOVEMENT_INVALID');
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000e31'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'OUT', 1, 'ADJUSTMENT', NULL, 'stock_adjustments');
SELECT ok(fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid, sid('LGAC-0002'), 'WRITTEN_OFF', 'Danado sin arreglo', '00000000-0000-0000-0000-0000000000e1'::uuid, '00000000-0000-0000-0000-000000000e31'::uuid) = 'WRITTEN_OFF', 'RETURNED -> WRITTEN_OFF con ajuste');
SELECT expect_error(format($q$SELECT fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid,%L,'AVAILABLE','Revisado otra vez','00000000-0000-0000-0000-0000000000e1'::uuid,NULL)$q$, sid('LGAC-0002')), 'SERIAL_TRANSITION_INVALID');
SELECT ok(fnc_product_serials_inspect('00000000-0000-0000-0000-0000000000a1'::uuid, sid('LGAC-0003'), 'BLOCKED', 'Caja golpeada', '00000000-0000-0000-0000-0000000000e1'::uuid, NULL) = 'BLOCKED', 'AVAILABLE -> BLOCKED');

-- Mover ubicación
SELECT expect_error(format($q$SELECT fnc_product_serials_move_location('00000000-0000-0000-0000-0000000000a1'::uuid,ARRAY[%L]::uuid[],'00000000-0000-0000-0000-0000000001a3'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid,NULL)$q$, sid('LGAC-0004')), 'SERIAL_LOCATION_INVALID');
SELECT expect_error(format($q$SELECT fnc_product_serials_move_location('00000000-0000-0000-0000-0000000000a1'::uuid,ARRAY[%L]::uuid[],'00000000-0000-0000-0000-0000000001a2'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid,NULL)$q$, sid('LGAC-0002')), 'SERIAL_NOT_IN_STOCK');
SELECT ok(fnc_product_serials_move_location('00000000-0000-0000-0000-0000000000a1'::uuid, ARRAY[sid('LGAC-0004'), sid('LGAC-0003')]::uuid[], '00000000-0000-0000-0000-0000000001a2'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 'Exhibicion') = 2, 'mover 2 series a vitrina');
SELECT ok(fnc_product_serials_move_location('00000000-0000-0000-0000-0000000000a1'::uuid, ARRAY[sid('LGAC-0004')]::uuid[], '00000000-0000-0000-0000-0000000001a2'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 'Exhibicion') = 0, 'mover a la misma ubicacion no cambia nada');
SELECT ok((SELECT count(*) FROM product_serial_events WHERE event_type = 'LOCATION_CHANGED') = 2, '2 eventos LOCATION_CHANGED');

-- Baja por ajuste de salida
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000e32'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'OUT', 2, 'ADJUSTMENT', NULL, 'stock_adjustments');
SELECT expect_error(format($q$SELECT fnc_product_serials_write_off('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,ARRAY[%L]::uuid[],'00000000-0000-0000-0000-000000000e32'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid,'Perdida')$q$, sid('LGAC-0004')), 'SERIAL_COUNT_MISMATCH');
SELECT expect_error(format($q$SELECT fnc_product_serials_write_off('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,ARRAY[%L,%L]::uuid[],'00000000-0000-0000-0000-000000000e32'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid,'Perdida')$q$, sid('LGAC-0004'), sid('LGAC-0002')), 'SERIAL_NOT_AVAILABLE');
SELECT ok(fnc_product_serials_write_off('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,ARRAY[sid('LGAC-0004'), sid('LGAC-0003')]::uuid[],'00000000-0000-0000-0000-000000000e32'::uuid,'00000000-0000-0000-0000-0000000000e1'::uuid,'Perdida') = 2, 'baja de 2 series (AVAILABLE y BLOCKED)');

-- Entrega de pedido
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000e33'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'IN', 2, 'ADJUSTMENT', NULL, 'stock_adjustments');
SELECT ok((SELECT count(*) FROM fnc_product_serials_register('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000f1'::uuid,'ADJUSTMENT',NULL,NULL,'00000000-0000-0000-0000-000000000e33'::uuid,'["LGAC-0006","LGAC-0007"]',NULL,'00000000-0000-0000-0000-0000000000e1'::uuid)) = 2, 'ajuste de entrada con 2 series');
INSERT INTO orders VALUES ('00000000-0000-0000-0000-000000000f01'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid);
INSERT INTO order_items VALUES ('00000000-0000-0000-0000-000000000f02'::uuid, '00000000-0000-0000-0000-000000000f01'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid), ('00000000-0000-0000-0000-000000000f03'::uuid, '00000000-0000-0000-0000-000000000f01'::uuid, '00000000-0000-0000-0000-0000000000f2'::uuid);
INSERT INTO stock_movements VALUES ('00000000-0000-0000-0000-000000000f04'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'OUT', 1, 'SALE', '00000000-0000-0000-0000-000000000f01'::uuid, 'orders');
SELECT ok(fnc_product_serials_assign_order_delivery('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000f01'::uuid, jsonb_build_array(jsonb_build_object('productId', '00000000-0000-0000-0000-0000000000f2'::uuid, 'quantity', 1)), '00000000-0000-0000-0000-0000000000e1'::uuid) = 0, 'entrega sin series retorna 0');
SELECT expect_error(format($q$SELECT fnc_product_serials_assign_order_delivery('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000f01'::uuid,%L,'00000000-0000-0000-0000-0000000000e1'::uuid)$q$,
  jsonb_build_array(jsonb_build_object('productId', '00000000-0000-0000-0000-0000000000f1'::uuid, 'quantity', 1, 'stockMovementId', '00000000-0000-0000-0000-000000000f04'::uuid))), 'SERIAL_COUNT_MISMATCH');
SELECT ok(fnc_product_serials_assign_order_delivery('00000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-000000000f01'::uuid,
  jsonb_build_array(jsonb_build_object('productId', '00000000-0000-0000-0000-0000000000f1'::uuid, 'quantity', 1, 'stockMovementId', '00000000-0000-0000-0000-000000000f04'::uuid, 'serialIds', jsonb_build_array(sid('LGAC-0006')))), '00000000-0000-0000-0000-0000000000e1'::uuid) = 1, 'entrega asigna 1 serie');
SELECT ok((SELECT order_id = '00000000-0000-0000-0000-000000000f01'::uuid AND order_item_id = '00000000-0000-0000-0000-000000000f02'::uuid AND status = 'SOLD' AND out_stock_movement_id = '00000000-0000-0000-0000-000000000f04'::uuid FROM product_serials WHERE serial_number_normalized = 'LGAC-0006'), 'serie entregada enlazada al pedido');

-- Invariante: series en existencia = entradas - salidas del producto en la sucursal
SELECT ok(
  (SELECT count(*) FROM product_serials WHERE product_id = '00000000-0000-0000-0000-0000000000f1'::uuid AND branch_id = '00000000-0000-0000-0000-0000000000b1'::uuid AND status IN ('AVAILABLE','RETURNED','BLOCKED'))
  = (SELECT sum(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) FROM stock_movements WHERE product_id = '00000000-0000-0000-0000-0000000000f1'::uuid AND branch_id = '00000000-0000-0000-0000-0000000000b1'::uuid),
  'conciliacion series = kardex');
SELECT event_type, count(*) FROM product_serial_events GROUP BY 1 ORDER BY 1;

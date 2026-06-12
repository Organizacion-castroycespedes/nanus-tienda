# Manifest SQL cronologico para `manus_tienda_qa`

Estado: documental. No ejecutar este archivo como script.

Objetivo: documentar el orden logico y el runner real para crear una base QA limpia `manus_tienda_qa` sin copiar datos operativos desde `manus_tienda`.

## Resultado de inventario

- SQL versionados encontrados en `scripts/database/`: 119.
- SQL candidatos para bootstrap/control QA: 97.
- SQL obligatorios default para bootstrap limpio: 97.
- SQL fixtures funcionales opcionales: 1.
- SQL fixtures reporting legacy opcionales: 1.
- SQL excluidos del bootstrap limpio: 23.

Exclusiones:

- `scripts/database/tests/`: pruebas locales.
- `scripts/database/dev/`: fixtures locales y limpiezas locales.
- `scripts/database/rollbacks/`: rollback manual, no forward bootstrap.
- `scripts/database/finance/manual/`: consultas manuales.
- `scripts/database/sale/drafts/`: borradores.
- `*_rollback.sql`: rollback, no forward bootstrap.
- `scripts/database/migrations/20260505_reporting_pos_fixtures.sql`: fixture QA reporting legacy. No debe correr por defecto ni con fixtures funcionales.
- `scripts/database/migrations/20260611_mvp_01_2b_functional_qa_fixtures.sql`: fixture QA funcional MVP-01.2. No debe correr por defecto.

## Runner ejecutable

El bootstrap QA debe usar `scripts/database/bootstrap-manus-tienda-qa.sh`, que a su vez llama `scripts/database/migrate_prd.sh` con un env externo aprobado.

`migrate_prd.sh` mantiene un nombre historico. Para QA solo puede reutilizarse de forma controlada si el runbook lo autoriza, el env apunta a `DB_NAME=manus_tienda_qa`, existe backup/snapshot y `CONFIRM_CREATE_QA_DB=YES` fue aprobado.

Reglas del runner forward:

- `*_rollback.sql` y cualquier `*rollback*.sql` se omiten siempre en el flujo forward.
- Cada rollback omitido debe quedar registrado en logs con `Skipping rollback SQL in forward migration runner`.
- Los rollback SQL permanecen disponibles solo para rollback manual documentado y aprobado.
- Los fixtures QA funcionales siguen fuera del flujo default y solo corren con `RUN_OPTIONAL_QA_FIXTURES=YES`.
- El fixture reporting legacy sigue separado y solo corre con `RUN_REPORTING_QA_FIXTURES=YES`.
- Los grants runtime corren al final con prioridad `APP_DB_USER`, `DB_RUNTIME_USER`, `MANUS_RUNTIME_DB_USER` y fallback seguro a `manus_user`.
- El runner QA no usa `DB_USER` como fallback runtime para grants.

## Orden cronologico propuesto

### 1. Base schema y extensiones

Orden real del runner actual:

1. `001_initial_schema.sql`
2. `002_extensions.sql`

Nota: si en el futuro se separa extension/base schema, conservar compatibilidad con el orden probado por `migrate_prd.sh`.

### 2. Roles, terminales base, tenants y usuarios iniciales

3. `003_seed_roles.sql`
4. `008_pos_terminals_and_sessions.sql`
5. `005_seed_general_data.sql`
6. `004_seed_super_admin.sql`
7. `006_seed_menu_items.sql`
8. `products/2026_04_25_seed_menu_modules.sql`
9. `007_seed_role_menu_permissions.sql`
10. `products/2026_04_26_seed_menu_role_actions.sql`
11. `009_seed_demo_operational_users.sql`
12. `010_seed_demo_user_roles.sql`

### 3. Inventario, clientes, proveedores, pedidos y compras

13. `products/2026_04_25_inventory_products.sql`
14. `products/2026_04_26_inventory_units_taxes_is_active.sql`
15. `products/2026_04_25_seed_inventory_units.sql`
16. `products/2026_04_25_seed_inventory_taxes.sql`
17. `products/2026_04_26_inventory_suppliers.sql`
18. `products/2026_04_26_inventory_customers.sql`
19. `products/2026_04_26_inventory_customers_location.sql`
20. `products/2026_04_26_inventory_orders.sql`
21. `products/2026_04_26_inventory_order_items.sql`
22. `products/2026_04_30_inventory_order_billing.sql`
23. `products/2026_04_25_inventory_purchases.sql`
24. `products/2026_04_26_inventory_purchases_type_balance.sql`
25. `products/2026_04_25_inventory_purchase_items.sql`
26. `products/2026_04_26_inventory_purchase_items_partial_reception.sql`
27. `products/2026_04_25_inventory_stock_movements.sql`
28. `products/2026_04_28_inventory_stock_movements_pos_context.sql`

### 4. Ventas y pagos base

29. `sale/001_sales.sql`
30. `sale/002_sale_items.sql`
31. `sale/003_sale_item_taxes.sql`
32. `sale/004_sale_payment_methods.sql`
33. `sale/010_sales_pos_context.sql`
34. `sale/005_relations_indexes.sql`
35. `sale/007_update_sales_balance_constraint.sql`
36. `sale/008_update_orders_status_constraint.sql`
37. `sale/011_sales_refunded_branch_stock.sql`

### 5. Finanzas y caja

38. `finance/migrations/20260430_1753_finance_base_infrastructure.sql`
39. `finance/migrations/20260430_1947_finance_payments_engine.sql`
40. `finance/migrations/20260502_1015_finance_cash_closing_controls.sql`
41. `finance/patches/20260430_1956_finance_payment_integration.sql`
42. `finance/patches/20260502_1135_finance_menu_access.sql`
43. `finance/patches/20260502_1840_finance_cash_movements_reference_text.sql`
44. `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`

### 6. Funciones y vistas

45. `sale/006_create_sale_function.sql`
46. `sale/009_cancel_sale_function.sql`
47. `sale/012_sale_financial_sync_and_pos_function.sql`
48. `products/2026_05_01_inventory_dashboard.sql`

### 7. Migraciones incrementales

El runner aplica `scripts/database/migrations/*.sql` en orden alfabetico `LC_ALL=C sort`.

Incluidas para forward bootstrap:

1. `20260503_sync_crm_customers_menu_permissions.sql`
2. `20260504_invoice_order_function.sql`
3. `20260504_reporting_phase1_base.sql`
4. `20260504_reporting_pos_sales.sql`
5. `20260505_reporting_menu_items_routes_upsert.sql`
6. `20260505_sync_local_to_aws_reporting_and_sales.sql`
7. `20260506_reporting_cash_reports.sql`
8. `20260506_reporting_user_scope_fix.sql`
9. `20260507_reporting_phase5_business_reports.sql`
10. `20260508_reporting_routes_permissions.sql`
11. `20260509_reporting_phase5_routes_permissions.sql`
12. `20260527_purchase_cancel_permission.sql`
13. `20260527_purchase_cancellation_reporting_totals.sql`
14. `20260527_purchase_cancellation_traceability.sql`
15. `20260527_purchase_partial_liquidation.sql`
16. `20260527_purchase_partial_liquidation_reporting.sql`
17. `20260527_purchase_settle_partial_permission.sql`
18. `20260527_purchase_ticket_partial_liquidation.sql`
19. `20260601_inventory_products_lots_phase_1.sql`
20. `20260602_inventory_create_sale_v2.sql`
21. `20260603_electronic_invoicing_customers_phase_1.sql`
22. `20260604_electronic_invoicing_suppliers_phase_1.sql`
23. `20260605_pricing_promotions_phase_1.sql`
24. `20260606_pricing_promotions_menu_permissions.sql`
25. `20260607_orders_pricing_snapshot_phase_6_7_1.sql`
26. `20260608_promotions_menu_visible_phase_6_9_3.sql`
27. `V046__add_execution_time_ms_to_migrations_history.sql`
28. `V047__sync_dev_functions_to_prd.sql`
29. `V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql`
30. `V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`
31. `V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql`
32. `V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql`
33. `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`
34. `V053__products_sale_model_phase_11_1.sql`
35. `V054__pos_terminal_peripheral_settings_phase_12.sql`
36. `V055__purchases_total_original_drift_fix.sql`
37. `V056__purchase_liquidation_audit_index_drift_fix.sql`
38. `V057__restore_report_purchase_ticket_after_v047.sql`
39. `V058__qa_required_catalog_seed.sql`
40. `V059__purchase_status_constraint_partial_liquidation_drift_fix.sql`
41. `V060__restore_report_pos_sales_signature.sql`
42. `V061__drop_legacy_report_pos_sales_overload.sql`

Confirmacion:

- `V053__products_sale_model_phase_11_1.sql` incluida.
- `V054__pos_terminal_peripheral_settings_phase_12.sql` incluida.
- `V055__purchases_total_original_drift_fix.sql` incluida para versionar `purchases.total_original`.
- `V056__purchase_liquidation_audit_index_drift_fix.sql` incluida para versionar `idx_auditoria_eventos_purchase_liquidated`.
- `V057__restore_report_purchase_ticket_after_v047.sql` incluida para restaurar `report_purchase_ticket` despues de `V047`.
- `V058__qa_required_catalog_seed.sql` incluida para normalizar consumidor final FE y asegurar unidades/impuestos base.
- `V059__purchase_status_constraint_partial_liquidation_drift_fix.sql` incluida para eliminar constraints legacy de `purchases.status` y permitir `CERRADA_PARCIAL`.
- `V060__restore_report_pos_sales_signature.sql` incluida para restaurar `report_pos_sales` con la firma esperada por `backend-reporteria`.
- `V061__drop_legacy_report_pos_sales_overload.sql` incluida para eliminar el overload legacy de `report_pos_sales` con filtros de cliente y dejar una sola firma de 8 parametros.
- Fixtures QA excluidos del forward bootstrap por defecto:
  - `20260611_mvp_01_2b_functional_qa_fixtures.sql`: funcional MVP-01.2, solo con `RUN_OPTIONAL_QA_FIXTURES=YES`.
  - `20260505_reporting_pos_fixtures.sql`: reporting legacy, solo con `RUN_REPORTING_QA_FIXTURES=YES`.
- Rollback SQL excluidos del forward bootstrap:
  - `20260601_inventory_products_lots_phase_1_rollback.sql`
  - `20260602_inventory_create_sale_v2_rollback.sql`
  - `20260603_electronic_invoicing_customers_phase_1_rollback.sql`
  - `20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`
  - `20260605_pricing_promotions_phase_1_rollback.sql`
  - `20260607_orders_pricing_snapshot_phase_6_7_1_rollback.sql`

### 8. Seed minimo final

1. `011_prd_default_customer.sql`

### 9. Grants runtime app

1. `012_runtime_db_grants.sql`

Este script concede al usuario runtime:

- `CONNECT` sobre la base actual.
- `USAGE` sobre schema `public`.
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre tablas existentes.
- `USAGE`, `SELECT`, `UPDATE` sobre secuencias existentes.
- `EXECUTE` sobre funciones existentes.
- `ALTER DEFAULT PRIVILEGES` para tablas, secuencias y funciones futuras creadas por el owner que ejecuta el bootstrap.

### Nota de idempotencia legacy

- `migrations/20260505_sync_local_to_aws_reporting_and_sales.sql` es un patch legacy de sincronizacion local -> AWS. Debe ser idempotente para bootstrap limpio. El `DROP FUNCTION` de `public.report_customer_orders_status(...)` usa `IF EXISTS` para no fallar cuando la funcion aun no existe.
- `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` entra al flujo forward principal para crear `cash_movements.payment_id`, FK e indices sin depender del runner finance separado.
- `migrations/V055__purchases_total_original_drift_fix.sql` es idempotente y hace backfill seguro desde `purchases.total`.
- `migrations/V056__purchase_liquidation_audit_index_drift_fix.sql` es idempotente y no depende de datos.
- `migrations/V057__restore_report_purchase_ticket_after_v047.sql` usa `CREATE OR REPLACE FUNCTION` para que el bootstrap limpio conserve la version con liquidacion parcial despues de `V047`.
- `migrations/V058__qa_required_catalog_seed.sql` normaliza `is_default` vs `is_final_consumer`, crea un consumidor final activo por tenant si falta y asegura unidades/impuestos base.
- `migrations/V059__purchase_status_constraint_partial_liquidation_drift_fix.sql` es idempotente y normaliza los constraints `purchases_status_check` y `chk_purchases_status`.
- `migrations/V060__restore_report_pos_sales_signature.sql` restaura `report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)` y valida la firma con `pg_get_function_arguments`.
- `migrations/V061__drop_legacy_report_pos_sales_overload.sql` elimina el overload `report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text)` y valida que queda un solo overload.
- `012_runtime_db_grants.sql` es idempotente. Reaplicar `GRANT` y `ALTER DEFAULT PRIVILEGES` no duplica permisos.

### 9. Seeds adicionales identificados

- `migrations/20260505_reporting_pos_fixtures.sql`: fixture QA de reporteria POS legacy. Requiere usuario fijo `781912fe-5a32-483f-b99a-a931f9700913` y caja/sesion especifica. No es migracion estructural; solo debe ejecutarse con `RUN_REPORTING_QA_FIXTURES=YES`.
- `migrations/20260611_mvp_01_2b_functional_qa_fixtures.sql`: fixture QA funcional opcional para producto demo, proveedor FE demo, cliente FE demo, lote demo, balance y trazabilidad por movimiento. Solo corre con `APPLY_OPTIONAL_FIXTURES=YES` o `RUN_OPTIONAL_QA_FIXTURES=YES`.
- `012_seed_electronic_invoicing_suppliers_menu_permissions.sql`: identificado como seed adicional FE; requiere decision explicita antes de incluirlo en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_units.sql`: seed de unidades base; incluido en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_taxes.sql`: seed de impuestos base; incluido en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_products.sql`: productos demo; no requerido para base limpia.
- `products/2026_04_26_seed_inventory_customers.sql`: clientes demo; no requerido para base limpia.
- `products/2026_04_26_seed_inventory_suppliers.sql`: proveedores demo; no requerido para base limpia.

## Seeds minimos esperados por funcion

- Tenant/sucursal: `005_seed_general_data.sql`.
- Roles: `003_seed_roles.sql`.
- Usuarios QA: `004_seed_super_admin.sql`, `009_seed_demo_operational_users.sql`, `010_seed_demo_user_roles.sql`.
- Menu: `006_seed_menu_items.sql`, `products/2026_04_25_seed_menu_modules.sql`.
- Permisos/RBAC: `007_seed_role_menu_permissions.sql`, `products/2026_04_26_seed_menu_role_actions.sql`.
- Consumidor final: `migrations/V058__qa_required_catalog_seed.sql` normaliza FE; `011_prd_default_customer.sql` queda como seed legacy idempotente.
- Metodos de pago base: `sale/004_sale_payment_methods.sql` y finanzas.
- Impuestos/unidades: `products/2026_04_25_seed_inventory_units.sql`, `products/2026_04_25_seed_inventory_taxes.sql` y refuerzo idempotente en `migrations/V058__qa_required_catalog_seed.sql`.
- Terminal POS default: `008_pos_terminals_and_sessions.sql`, y ajuste final `V054__pos_terminal_peripheral_settings_phase_12.sql`.
- Peripheral settings MOCK: `V054__pos_terminal_peripheral_settings_phase_12.sql`.
- Grants runtime API: `012_runtime_db_grants.sql` con `APP_DB_USER=manus_user` en QA.

## Relacion con scripts y runbooks

- `scripts/database/bootstrap-manus-tienda-qa.sh`: wrapper seguro para QA. Requiere env externo, `CONFIRM_CREATE_QA_DB=YES`, `DB_NAME=manus_tienda_qa`, `LOG_DIR`, y valida este manifiesto antes de delegar.
- `scripts/database/migrate_prd.sh`: runner historico de schema completo. Nombre historico; usar para QA solo si este runbook lo permite y el env apunta a `manus_tienda_qa`. El runner excluye rollback SQL del flujo forward y aplica grants runtime al final.
- `scripts/database/seed.sh`: runner local/legado para seeds posteriores. No es el runner principal del bootstrap QA limpio.
- `docs/database-runbook.md`: runbook general DB. Este manifiesto lo complementa con el caso QA aislado.
- `docs/runbook-bootstrap-manus-tienda-qa.md`: runbook operativo especifico para `manus_tienda_qa`.

## Riesgos

- El nombre `migrate_prd.sh` puede inducir error humano. Usarlo solo via `bootstrap-manus-tienda-qa.sh`.
- `20260611_mvp_01_2b_functional_qa_fixtures.sql` es fixture funcional opcional y no corre por defecto.
- `20260505_reporting_pos_fixtures.sql` es fixture reporting legacy opcional y no corre por defecto ni con `RUN_OPTIONAL_QA_FIXTURES=YES`.
- `012_seed_electronic_invoicing_suppliers_menu_permissions.sql` esta inventariado pero no incluido hoy por el runner completo.
- Si el usuario runtime resuelto apunta a un rol inexistente, `012_runtime_db_grants.sql` debe fallar con error claro para no dejar login roto silenciosamente.
- Seeds de unidades/impuestos base ya forman parte del bootstrap limpio actual.
- Si falta un SQL del orden anterior, el bootstrap debe bloquearse antes de tocar QA.
- No ejecutar contra `manus_tienda`.

## Resultado

`QA_BOOTSTRAP_MANIFEST_READY`

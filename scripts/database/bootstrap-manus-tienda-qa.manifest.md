# Manifest SQL cronologico para `manus_tienda_qa`

Estado: documental. No ejecutar este archivo como script.

Objetivo: documentar el orden logico y el runner real para crear una base QA limpia `manus_tienda_qa` sin copiar datos operativos desde `manus_tienda`.

## Resultado de inventario

- SQL versionados encontrados en `scripts/database/`: 113.
- SQL candidatos para bootstrap/control QA: 90.
- SQL excluidos del bootstrap limpio: 23.

Exclusiones:

- `scripts/database/tests/`: pruebas locales.
- `scripts/database/dev/`: fixtures locales y limpiezas locales.
- `scripts/database/rollbacks/`: rollback manual, no forward bootstrap.
- `scripts/database/finance/manual/`: consultas manuales.
- `scripts/database/sale/drafts/`: borradores.
- `*_rollback.sql`: rollback, no forward bootstrap.

## Runner ejecutable

El bootstrap QA debe usar `scripts/database/bootstrap-manus-tienda-qa.sh`, que a su vez llama `scripts/database/migrate_prd.sh` con un env externo aprobado.

`migrate_prd.sh` mantiene un nombre historico. Para QA solo puede reutilizarse de forma controlada si el runbook lo autoriza, el env apunta a `DB_NAME=manus_tienda_qa`, existe backup/snapshot y `CONFIRM_CREATE_QA_DB=YES` fue aprobado.

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
15. `products/2026_04_26_inventory_suppliers.sql`
16. `products/2026_04_26_inventory_customers.sql`
17. `products/2026_04_26_inventory_customers_location.sql`
18. `products/2026_04_26_inventory_orders.sql`
19. `products/2026_04_26_inventory_order_items.sql`
20. `products/2026_04_30_inventory_order_billing.sql`
21. `products/2026_04_25_inventory_purchases.sql`
22. `products/2026_04_26_inventory_purchases_type_balance.sql`
23. `products/2026_04_25_inventory_purchase_items.sql`
24. `products/2026_04_26_inventory_purchase_items_partial_reception.sql`
25. `products/2026_04_25_inventory_stock_movements.sql`
26. `products/2026_04_28_inventory_stock_movements_pos_context.sql`

### 4. Ventas y pagos base

27. `sale/001_sales.sql`
28. `sale/002_sale_items.sql`
29. `sale/003_sale_item_taxes.sql`
30. `sale/004_sale_payment_methods.sql`
31. `sale/010_sales_pos_context.sql`
32. `sale/005_relations_indexes.sql`
33. `sale/007_update_sales_balance_constraint.sql`
34. `sale/008_update_orders_status_constraint.sql`
35. `sale/011_sales_refunded_branch_stock.sql`

### 5. Finanzas y caja

36. `finance/migrations/20260430_1753_finance_base_infrastructure.sql`
37. `finance/migrations/20260430_1947_finance_payments_engine.sql`
38. `finance/migrations/20260502_1015_finance_cash_closing_controls.sql`
39. `finance/patches/20260430_1956_finance_payment_integration.sql`
40. `finance/patches/20260502_1135_finance_menu_access.sql`
41. `finance/patches/20260502_1840_finance_cash_movements_reference_text.sql`

### 6. Funciones y vistas

42. `sale/006_create_sale_function.sql`
43. `sale/009_cancel_sale_function.sql`
44. `sale/012_sale_financial_sync_and_pos_function.sql`
45. `products/2026_05_01_inventory_dashboard.sql`

### 7. Migraciones incrementales

El runner aplica `scripts/database/migrations/*.sql` en orden alfabetico `LC_ALL=C sort`.

Incluidas para forward bootstrap:

1. `20260503_sync_crm_customers_menu_permissions.sql`
2. `20260504_invoice_order_function.sql`
3. `20260504_reporting_phase1_base.sql`
4. `20260504_reporting_pos_sales.sql`
5. `20260505_reporting_menu_items_routes_upsert.sql`
6. `20260505_reporting_pos_fixtures.sql`
7. `20260505_sync_local_to_aws_reporting_and_sales.sql`
8. `20260506_reporting_cash_reports.sql`
9. `20260506_reporting_user_scope_fix.sql`
10. `20260507_reporting_phase5_business_reports.sql`
11. `20260508_reporting_routes_permissions.sql`
12. `20260509_reporting_phase5_routes_permissions.sql`
13. `20260527_purchase_cancel_permission.sql`
14. `20260527_purchase_cancellation_reporting_totals.sql`
15. `20260527_purchase_cancellation_traceability.sql`
16. `20260527_purchase_partial_liquidation.sql`
17. `20260527_purchase_partial_liquidation_reporting.sql`
18. `20260527_purchase_settle_partial_permission.sql`
19. `20260527_purchase_ticket_partial_liquidation.sql`
20. `20260601_inventory_products_lots_phase_1.sql`
21. `20260602_inventory_create_sale_v2.sql`
22. `20260603_electronic_invoicing_customers_phase_1.sql`
23. `20260604_electronic_invoicing_suppliers_phase_1.sql`
24. `20260605_pricing_promotions_phase_1.sql`
25. `20260606_pricing_promotions_menu_permissions.sql`
26. `20260607_orders_pricing_snapshot_phase_6_7_1.sql`
27. `20260608_promotions_menu_visible_phase_6_9_3.sql`
28. `V046__add_execution_time_ms_to_migrations_history.sql`
29. `V047__sync_dev_functions_to_prd.sql`
30. `V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql`
31. `V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`
32. `V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql`
33. `V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql`
34. `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`
35. `V053__products_sale_model_phase_11_1.sql`
36. `V054__pos_terminal_peripheral_settings_phase_12.sql`

Confirmacion:

- `V053__products_sale_model_phase_11_1.sql` incluida.
- `V054__pos_terminal_peripheral_settings_phase_12.sql` incluida.

### 8. Seed minimo final

1. `011_prd_default_customer.sql`

### 9. Seeds adicionales identificados

- `012_seed_electronic_invoicing_suppliers_menu_permissions.sql`: identificado como seed adicional FE; requiere decision explicita antes de incluirlo en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_units.sql`: seed de unidades base; hoy no esta en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_taxes.sql`: seed de impuestos base; hoy no esta en `migrate_prd.sh`.
- `products/2026_04_25_seed_inventory_products.sql`: productos demo; no requerido para base limpia.
- `products/2026_04_26_seed_inventory_customers.sql`: clientes demo; no requerido para base limpia.
- `products/2026_04_26_seed_inventory_suppliers.sql`: proveedores demo; no requerido para base limpia.

## Seeds minimos esperados por funcion

- Tenant/sucursal: `005_seed_general_data.sql`.
- Roles: `003_seed_roles.sql`.
- Usuarios QA: `004_seed_super_admin.sql`, `009_seed_demo_operational_users.sql`, `010_seed_demo_user_roles.sql`.
- Menu: `006_seed_menu_items.sql`, `products/2026_04_25_seed_menu_modules.sql`.
- Permisos/RBAC: `007_seed_role_menu_permissions.sql`, `products/2026_04_26_seed_menu_role_actions.sql`.
- Consumidor final: `011_prd_default_customer.sql`.
- Metodos de pago base: `sale/004_sale_payment_methods.sql` y finanzas.
- Impuestos/unidades: estructura incluida por inventario; seeds especificos quedan pendientes si QA requiere catalogos de demostracion.
- Terminal POS default: `008_pos_terminals_and_sessions.sql`, y ajuste final `V054__pos_terminal_peripheral_settings_phase_12.sql`.
- Peripheral settings MOCK: `V054__pos_terminal_peripheral_settings_phase_12.sql`.

## Relacion con scripts y runbooks

- `scripts/database/bootstrap-manus-tienda-qa.sh`: wrapper seguro para QA. Requiere env externo, `CONFIRM_CREATE_QA_DB=YES`, `DB_NAME=manus_tienda_qa`, `LOG_DIR`, y valida este manifiesto antes de delegar.
- `scripts/database/migrate_prd.sh`: runner historico de schema completo. Nombre historico; usar para QA solo si este runbook lo permite y el env apunta a `manus_tienda_qa`.
- `scripts/database/seed.sh`: runner local/legado para seeds posteriores. No es el runner principal del bootstrap QA limpio.
- `docs/database-runbook.md`: runbook general DB. Este manifiesto lo complementa con el caso QA aislado.
- `docs/runbook-bootstrap-manus-tienda-qa.md`: runbook operativo especifico para `manus_tienda_qa`.

## Riesgos

- El nombre `migrate_prd.sh` puede inducir error humano. Usarlo solo via `bootstrap-manus-tienda-qa.sh`.
- `012_seed_electronic_invoicing_suppliers_menu_permissions.sql` esta inventariado pero no incluido hoy por el runner completo.
- Seeds de unidades/impuestos demo estan inventariados, pero no todos forman parte del bootstrap limpio actual.
- Si falta un SQL del orden anterior, el bootstrap debe bloquearse antes de tocar QA.
- No ejecutar contra `manus_tienda`.

## Resultado

`QA_BOOTSTRAP_MANIFEST_READY`

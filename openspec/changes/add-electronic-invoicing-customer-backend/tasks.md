# Tasks: add-electronic-invoicing-customer-backend

## Fase 0: analisis y especificacion

- [x] 1. Confirmar rama `feat/fe-clientes-adquirientes-openspec`.
- [x] 2. Identificar estructura actual del backend `api/`.
- [x] 3. Identificar modulo actual de clientes en `InventoryModule`.
- [x] 4. Identificar entidades, controller, service y repository de clientes.
- [x] 5. Identificar SQL relacionado con `customers` y consumidor final.
- [x] 6. Identificar manejo multi-tenant, tenants, tenants_detalles, branches, users y JWT.
- [x] 7. Identificar manejo actual de migraciones y scripts SQL.
- [x] 8. Identificar auditoria, soft delete y estados activos/inactivos.
- [x] 9. Identificar contratos actuales que no deben romperse.
- [x] 10. Crear `proposal.md`.
- [x] 11. Crear `design.md`.
- [x] 12. Crear `tasks.md`.
- [x] 13. Crear delta spec `electronic-invoicing-customers`.

## Fase 1: decisiones antes de implementar

- [x] 1. Confirmar diseno provider-agnostic sin amarrar a DIAN directo ni proveedor tecnologico.
- [x] 2. Confirmar preparacion futura de `ElectronicInvoicingProviderAdapter`.
- [x] 3. Confirmar que primera implementacion puede operar en modo `MOCK_LOCAL` / preview.
- [x] 4. Confirmar consumidor final unico por tenant.
- [x] 5. Confirmar que la sucursal viene del contexto de venta, no del cliente.
- [x] 6. Confirmar endpoint para asegurar consumidor final default.
- [x] 7. Confirmar que no se duplica consumidor final por sucursal.
- [x] 8. Confirmar que `fiscalEmail` no es obligatorio al crear cliente.
- [x] 9. Confirmar que `fiscalEmail` se exige solo cuando el flujo de emision electronica nominada lo necesite.
- [x] 10. Confirmar que POS puede vender con consumidor final sin email.
- [x] 11. Confirmar menu key principal `ELECTRONIC_INVOICING_CUSTOMERS`.
- [x] 12. Confirmar menu keys futuras `ELECTRONIC_INVOICING_DOCUMENTS`, `ELECTRONIC_INVOICING_SETTINGS` y `ELECTRONIC_INVOICING_REPORTS`.
- [x] 13. Confirmar que primera version no guarda raw response DIAN completo.
- [x] 14. Confirmar resumen operativo para lookup: `status`, `statusCode`, `message`, `provider`, `lookupAt`, `requestHash`, `responseSummary`.
- [x] 15. Confirmar que raw response futuro debe guardarse cifrado o en almacenamiento seguro.
- [x] 16. Confirmar que `dian_document_types` sera catalogo versionable.
- [x] 17. Confirmar que no se hardcodean tipos DIAN en codigo.
- [x] 18. Confirmar que el seed de catalogo espera fuente vigente.
- [x] 19. Confirmar compatibilidad de `/api/customers`, ventas, pedidos, POS y reportes.
- [ ] 20. Confirmar fuente oficial vigente para tipos de documento antes de seed.
- [ ] 21. Confirmar formato fiscal exacto del consumidor final antes de migracion.
- [x] 22. Confirmar que la identidad fiscal se queda por tenant en FE-1, sin anticipar `company_id`.
- [ ] 23. Confirmar si se habilitara validation pipe global o validacion manual local.
- [ ] 24. Confirmar politica de retencion de logs de consulta.
- [x] 25. Confirmar estrategia de migracion para clientes existentes sin tipo de documento: campos opcionales y backfill solo de `document_number_normalized`.

## Fase 2: modelo de datos futuro

- [x] 1. Disenar migracion aditiva de `customers` para campos fiscales.
- [x] 2. Disenar catalogo versionable `dian_document_types` sin hardcodear tipos en codigo.
- [x] 3. Disenar tabla `dian_acquirer_lookup_logs` con resumen operativo, sin raw response completo.
- [x] 4. Definir indices de consulta fiscal y consumidor final activo unico por tenant.
- [x] 5. Definir regla fisica de consumidor final unico por tenant.
- [x] 6. Definir campos auditables de lookup `looked_up_by`, `looked_up_at` y `created_at`.
- [x] 7. Definir rollback conservador sin perdida de clientes operativos.
- [x] 8. Definir backfill de `document_number` actual hacia `document_number_normalized`.
- [ ] 9. Definir seed idempotente del catalogo DIAN solo despues de confirmar fuente vigente.
- [ ] 10. Definir seed de menu/permisos para el modulo nuevo.
- [x] 11. Crear migracion `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql`.
- [x] 12. Crear rollback `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql`.
- [x] 13. Crear runbook `docs/runbook-migracion-clientes-fe-fase-fe-1.md`.

## Fase 2.1: QA local migracion FE-1

- [x] 1. Confirmar ambiente local `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=manus_tienda_prd`.
- [x] 2. Confirmar conexion local por loopback y no PRD real.
- [x] 3. Crear backup local antes de migrar.
- [x] 4. Registrar version PostgreSQL local.
- [x] 5. Registrar conteo `customers` antes de migrar.
- [x] 6. Ejecutar migracion FE-1 local.
- [x] 7. Validar columnas fiscales nuevas en `customers`.
- [x] 8. Validar tablas `dian_document_types` y `dian_acquirer_lookup_logs`.
- [x] 9. Validar constraints fiscales y de lookup.
- [x] 10. Validar indices FE-1.
- [x] 11. Validar compatibilidad estructural de `customers`.
- [x] 12. Ejecutar rollback local.
- [x] 13. Validar rollback local.
- [x] 14. Reaplicar migracion local.
- [x] 15. Validar DB local migrada despues de reaplicar.
- [x] 16. Crear evidencia `docs/evidencia-migracion-clientes-fe-fase-fe-1-1.md`.
- [x] 17. No ejecutar SQL contra PRD real ni comandos remotos.

## Fase 3: backend modulo electronic-invoicing

- [x] 1. Crear `ElectronicInvoicingModule`.
- [x] 2. Registrar el modulo en `AppModule`.
- [x] 3. Crear submodulo o carpeta `customers`.
- [x] 4. Crear tipos fiscales de cliente.
- [x] 5. Crear DTOs `CreateElectronicInvoicingCustomerDto` y `UpdateElectronicInvoicingCustomerDto`.
- [x] 6. Crear repository tenant-aware para `customers`.
- [x] 7. Crear service con validaciones fiscales.
- [x] 8. Crear controller REST bajo `/api/electronic-invoicing/customers`.
- [x] 9. Proteger endpoints con JWT, roles y permisos.
- [ ] 10. Registrar auditoria en `auditoria_eventos`.
- [x] 11. Mantener rutas `/api/customers` sin cambios.
- [x] 12. Agregar tests unitarios de reglas de cliente fiscal.
- [x] 13. Crear evidencia `docs/evidencia-backend-clientes-fe-fase-fe-2.md`.
- [x] 14. Confirmar que no se implemento GetAcquirer real ni consumo DIAN.

## Fase 3.1: FE-2.1 diseno backend especializado facturacion electronica

- [x] 1. Analizar modulo actual `api/src/modules/electronic-invoicing`.
- [x] 2. Analizar clientes, tipos de documento, ventas, items, pedidos, pagos, tenants y sucursales como fuentes operativas.
- [x] 3. Definir responsabilidades que se quedan en `api/`.
- [x] 4. Definir responsabilidades de `backend-facturacion-electronica/`.
- [x] 5. Evaluar comunicacion por HTTP interno, eventos y consulta de ventas listas.
- [x] 6. Recomendar HTTP interno controlado para primera version y futuro event-driven.
- [x] 7. Disenar estructura propuesta del backend especializado.
- [x] 8. Disenar modelo conceptual de documentos electronicos.
- [x] 9. Disenar flujo POS/Orders -> `api/` -> backend FE -> DIAN/proveedor -> estado.
- [x] 10. Definir que no se debe mover todavia: clientes, POS, pedidos, ventas, pagos, inventario y pricing.
- [x] 11. Definir fases FE-2.2 a FE-2.9.
- [x] 12. Crear `docs/diseno-backend-especializado-facturacion-electronica-fe-2-1.md`.
- [x] 13. Confirmar que FE-2 actual queda justificado como modulo de clientes fiscales en `api/`.

## Fase 4: catalogo DIAN

- [x] 1. Crear repository de `dian_document_types`.
- [x] 2. Crear service de catalogo.
- [x] 3. Crear endpoint `GET /api/electronic-invoicing/document-types`.
- [ ] 4. Validar tipo de documento activo.
- [ ] 5. Validar `verificationDigit` para NIT.
- [x] 6. Agregar tests de catalogo y listado vacio.

## Fase 5: integracion DIAN GetAcquirer desacoplada

- [ ] 1. Crear `ElectronicInvoicingProviderAdapter` como interfaz provider-agnostic.
- [ ] 2. Crear adapter `MOCK_LOCAL` para preview sin dependencia externa.
- [ ] 3. Crear `DianAcquirerService`.
- [ ] 4. Crear repository de lookup logs.
- [ ] 5. Crear endpoint preview sin persistir.
- [ ] 6. Crear endpoint lookup para cliente existente.
- [ ] 7. Crear endpoint apply con confirmacion por campo.
- [ ] 8. Soportar integracion externa apagada y modo `MOCK_LOCAL`.
- [ ] 9. Registrar `dian_last_lookup_at` y `dian_last_lookup_status`.
- [ ] 10. No sobrescribir datos manuales sin `overwriteConfirmed=true`.
- [ ] 11. Guardar solo resumen operativo de lookup: `status`, `statusCode`, `message`, `provider`, `lookupAt`, `requestHash`, `responseSummary`.
- [ ] 12. Agregar tests de mock local, disabled, success, not found, timeout y apply.

## Fase 6: consumidor final

- [ ] 1. Definir constantes fiscales exactas de consumidor final aprobadas para FE-1.
- [x] 2. Crear endpoint `GET /api/electronic-invoicing/customers/default`.
- [x] 3. Crear endpoint `POST /api/electronic-invoicing/customers/default/ensure`.
- [ ] 4. Bloquear inactivacion de consumidor final.
- [ ] 5. Bloquear borrado logico de consumidor final.
- [x] 6. Probar que POS puede seguir usando consumidor final actual a nivel estructural sin tocar `/api/customers`.
- [x] 7. Probar que no se crea consumidor final duplicado por tenant.

## Fase 7: validaciones y seguridad

- [x] 1. Validar no duplicado por tenant y numero normalizado.
- [x] 2. Validar email fiscal cuando venga informado.
- [x] 3. Mantener documento opcional en FE-2, salvo reglas futuras de emision.
- [x] 4. Validar tenant desde JWT/contexto autenticado.
- [x] 5. Validar permisos por menu key `ELECTRONIC_INVOICING_CUSTOMERS`.
- [ ] 6. Validar que `SUPER_ADMIN` no cruce tenant sin permiso explicito.
- [ ] 7. Enmascarar datos sensibles en logs.
- [ ] 8. Auditar cambios fiscales before/after.
- [ ] 9. Agregar pruebas de acceso multi-tenant.
- [ ] 10. Bloquear emision electronica nominada futura si falta `fiscalEmail`.
- [x] 11. Normalizar `documentNumberNormalized` desde `documentNumber`.
- [x] 12. Validar consumidor final idempotente.

## Fase 8: validaciones a ejecutar

- [x] 1. Ejecutar `openspec validate add-electronic-invoicing-customer-backend --type change --strict --json`.
- [x] 2. Ejecutar pruebas unitarias backend especificas del modulo FE customers.
- [x] 3. Ejecutar build de `api/`.
- [ ] 4. En fase futura, ejecutar pruebas de integracion con DIAN mock.
- [x] 5. Confirmar que no hay tests legacy especificos de `/api/customers` para ejecutar.
- [x] 6. Ejecutar `git diff --check`.

## Guardrails

- [x] 1. No implementar XML UBL en este cambio.
- [x] 2. No implementar firma digital de factura en este cambio.
- [x] 3. No generar facturas electronicas en este cambio.
- [x] 4. No modificar frontend en esta fase.
- [x] 5. No crear migraciones fuera del alcance FE-1 autorizado.
- [x] 6. No tocar produccion.
- [x] 7. No cambiar contratos actuales de ventas, pedidos o POS sin otro OpenSpec.
- [x] 8. No modificar codigo backend funcional en FE-1.
- [x] 9. No tocar `backend-reporteria` en FE-1.
- [x] 10. No ejecutar SQL contra PRD en FE-1.

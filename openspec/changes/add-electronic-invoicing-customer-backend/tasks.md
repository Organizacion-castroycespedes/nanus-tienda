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

## Fase 3.2: FE-2.1R sync fiscal customers/suppliers

- [x] 1. Confirmar que `api/` conserva tablas operativas `customers` y `suppliers`.
- [x] 2. Confirmar que backend FE sera capa de consulta, normalizacion y sincronizacion fiscal de terceros.
- [x] 3. Definir `customers` sync: si existe actualiza campos permitidos, si no existe solicita creacion en `api/`.
- [x] 4. Definir `suppliers` sync: si existe actualiza campos permitidos, si no existe solicita creacion en `api/`.
- [x] 5. Confirmar que GetAcquirer se considera fuente para adquirientes/clientes.
- [x] 6. Confirmar que suppliers requiere diseno provider-agnostic sin asumir GetAcquirer.
- [x] 7. Definir idempotencia por `tenantId + partyType + documentTypeCode + documentNumberNormalized`.
- [x] 8. Definir logs seguros de lookup/sync sin raw response completo.
- [x] 9. Actualizar `docs/diseno-backend-especializado-facturacion-electronica-fe-2-1.md`.
- [x] 10. Crear `docs/decision-backend-fe-sincronizacion-clientes-proveedores-fe-2-1R.md`.
- [x] 11. Actualizar `design.md`.
- [x] 12. Actualizar delta spec `electronic-invoicing-customers`.
- [x] 13. Registrar fases siguientes FE-2.2 a FE-2.8 para prueba API, diseno sync, scaffolding, mock lookup, upsert e integraciones reales.

## Fase 3.3: FE-2.3 scaffolding backend-facturacion-electronica

- [x] 1. Crear carpeta `backend-facturacion-electronica/`.
- [x] 2. Crear proyecto NestJS basico con `package.json`, `tsconfig`, `nest-cli.json` y `src/main.ts`.
- [x] 3. Crear `.env.example` sin secretos reales.
- [x] 4. Crear `GET /health`.
- [x] 5. Crear modulo `providers` con interfaz `FiscalProviderAdapter`.
- [x] 6. Crear provider `MOCK_LOCAL`.
- [x] 7. Crear modulo `fiscal-lookup`.
- [x] 8. Crear `POST /fiscal-lookup/preview` mock para `CUSTOMER` y `SUPPLIER`.
- [x] 9. Normalizar `documentNumber` quitando espacios, puntos y guiones.
- [x] 10. Rechazar `partyType` invalido.
- [x] 11. Crear modulo `sync` preparatorio sin llamadas a `api/`.
- [x] 12. Crear placeholders `invoices`, `dian`, `certificates`, `documents`, `retries` y `webhooks`.
- [x] 13. Crear README del servicio.
- [x] 14. Agregar tests minimos de health y fiscal lookup mock.
- [x] 15. Ejecutar `npm install` usando `npm.cmd` por bloqueo de PowerShell a `npm.ps1`.
- [x] 16. Ejecutar `npm run build`.
- [x] 17. Ejecutar `npm test`.
- [x] 18. Crear evidencia `docs/evidencia-scaffolding-backend-facturacion-electronica-fe-2-3.md`.
- [x] 19. Confirmar que no se implemento DIAN real, GetAcquirer real, certificados reales ni integracion real con `api/`.
- [x] 20. Confirmar que no se modifico `api/`, `web/`, `backend-reporteria/`, SQL ni migraciones.
- [x] 21. Ejecutar smoke HTTP local de `GET /health` y `POST /fiscal-lookup/preview`.
- [x] 22. Ejecutar `openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json`.
- [x] 23. Ejecutar `git diff --check`.

## Fase 3.4: FE-2.4A diseno suppliers fiscales

- [x] 1. Analizar tabla `suppliers`.
- [x] 2. Analizar entidad/modelo `SupplierEntity`.
- [x] 3. Analizar controller, service y repository de suppliers.
- [x] 4. Identificar endpoints actuales `/api/suppliers`.
- [x] 5. Analizar relacion de suppliers con compras e inventario.
- [x] 6. Comparar `suppliers` contra campos fiscales de `customers`.
- [x] 7. Determinar que `suppliers` requiere migracion aditiva futura similar a `customers`.
- [x] 8. Disenar endpoints futuros `GET/POST/PATCH /api/electronic-invoicing/suppliers`.
- [x] 9. Disenar reglas de no duplicado por tenant + documento normalizado.
- [x] 10. Confirmar `fiscalEmail` opcional para suppliers.
- [x] 11. Disenar normalizacion de NIT/documento y DV futuro.
- [x] 12. Disenar actualizacion fiscal segura sin romper compras.
- [x] 13. Crear `docs/diseno-suppliers-fiscales-fe-2-4A.md`.
- [x] 14. Actualizar `design.md`.
- [x] 15. Actualizar delta spec con suppliers fiscales.
- [x] 16. Confirmar que no se creo codigo funcional, migraciones, endpoints ni SQL.

## Fase 3.5: FE-2.4B migracion suppliers fiscales

- [x] 1. Confirmar que `suppliers` actual tiene `tenant_id`.
- [x] 2. Disenar extension aditiva de `suppliers` sin tabla paralela.
- [x] 3. Crear migracion `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`.
- [x] 4. Agregar columnas fiscales opcionales: `document_type_code`, `document_number_normalized`, `verification_digit`, `legal_name`, `fiscal_email`, `fiscal_status`, `fiscal_provider`, `fiscal_last_lookup_at`, `fiscal_last_lookup_status`.
- [x] 5. Agregar constraints de `fiscal_status` y `fiscal_last_lookup_status`.
- [x] 6. Agregar backfill de `document_number` a `document_number_normalized`.
- [x] 7. Agregar indices de documento normalizado, estado fiscal y ultimo lookup.
- [x] 8. No crear unique fiscal todavia por posible duplicado historico.
- [x] 9. Crear rollback `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`.
- [x] 10. Crear runbook `docs/runbook-migracion-suppliers-fe-fase-fe-2-4B.md`.
- [x] 11. Actualizar `design.md` con alcance de migracion FE-2.4B.
- [x] 12. Confirmar que no se modifico codigo funcional, endpoints, frontend, `backend-reporteria` ni SQL fuera de migraciones autorizadas.
- [x] 13. Confirmar que no se ejecuto SQL contra PRD ni servidor remoto.

## Fase 3.6: FE-2.4C QA local migracion suppliers FE

- [x] 1. Confirmar ambiente local `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=manus_tienda_prd`.
- [x] 2. Confirmar conexion local por loopback y no PRD real.
- [x] 3. Registrar version PostgreSQL local.
- [x] 4. Crear backup local antes de migrar.
- [x] 5. Registrar conteos antes de `suppliers`, `purchases` y suppliers con documento.
- [x] 6. Registrar diagnostico de duplicados por `tenant_id + document_number_normalized` calculado.
- [x] 7. Ejecutar migracion suppliers FE local.
- [x] 8. Validar columnas fiscales nuevas en `suppliers`.
- [x] 9. Validar constraints de `fiscal_status` y `fiscal_last_lookup_status`.
- [x] 10. Validar que campos fiscales son opcionales y no exigen NIT/documento/email fiscal.
- [x] 11. Validar indices fiscales de suppliers.
- [x] 12. Validar compatibilidad con `purchases.supplier_id`.
- [x] 13. Validar backfill de `document_number_normalized`.
- [x] 14. Ejecutar rollback local.
- [x] 15. Validar rollback local sin perdida de suppliers ni purchases.
- [x] 16. Reaplicar migracion local.
- [x] 17. Dejar DB local migrada despues de reaplicar.
- [x] 18. Crear evidencia `docs/evidencia-migracion-suppliers-fe-fase-fe-2-4C.md`.
- [x] 19. Ejecutar `openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json`.
- [x] 20. Ejecutar `git diff --check`.
- [x] 21. Confirmar que no se toco PRD real, servidor remoto, codigo funcional, frontend ni `backend-reporteria`.

## Fase 3.7: FE-2.4D backend suppliers FE

- [x] 1. Crear tipos y DTOs para suppliers fiscales.
- [x] 2. Crear repository tenant-aware para `suppliers` fiscales con queries parametrizadas.
- [x] 3. Crear service de suppliers FE con normalizacion de documento.
- [x] 4. Crear controller `GET /api/electronic-invoicing/suppliers`.
- [x] 5. Crear controller `POST /api/electronic-invoicing/suppliers`.
- [x] 6. Crear controller `PATCH /api/electronic-invoicing/suppliers/:id`.
- [x] 7. Registrar controller/service/repository en `ElectronicInvoicingModule`.
- [x] 8. Validar `fiscalEmail` opcional con formato basico cuando venga.
- [x] 9. Validar `fiscalStatus` permitido.
- [x] 10. Validar `fiscalLastLookupStatus` permitido.
- [x] 11. Evitar duplicado por tenant + `documentNumberNormalized`.
- [x] 12. Permitir crear supplier sin `documentNumber`.
- [x] 13. Validar que supplier pertenezca al tenant en update.
- [x] 14. Agregar tests unitarios de suppliers FE.
- [x] 15. Ejecutar tests relacionados de compras.
- [x] 16. Ejecutar build de `api/`.
- [x] 17. Crear evidencia `docs/evidencia-backend-suppliers-fe-fase-fe-2-4D.md`.
- [x] 18. Confirmar que no se modifico `/api/suppliers` legacy.
- [x] 19. Confirmar que no se modifico `PurchaseService`, `PurchaseController` ni `purchases.supplier_id`.
- [x] 20. Confirmar que no se toco frontend, `backend-reporteria`, SQL/migraciones, PRD ni servidor remoto.

## Fase 3.8: FE-2.4E QA API local suppliers FE

- [x] 1. Confirmar ambiente local `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=manus_tienda_prd`.
- [x] 2. Confirmar PostgreSQL local y conexion por loopback, no PRD real.
- [x] 3. Confirmar API local levantada con endpoints FE suppliers actuales.
- [x] 4. Generar token local sin exponerlo e invalidar sesion temporal al finalizar.
- [x] 5. Crear fixture local seguro `QA FE 2.4E %` sin afectar compras reales.
- [x] 6. Probar `GET /api/electronic-invoicing/suppliers`.
- [x] 7. Validar que `GET` devuelve lista y campos fiscales.
- [x] 8. Probar filtros basicos `search`, `documentNumber`, `fiscalStatus` e `isActive`.
- [x] 9. Probar `POST /api/electronic-invoicing/suppliers` con `fiscalEmail`.
- [x] 10. Validar `documentNumberNormalized`, `fiscalEmail` y `fiscalStatus` en respuesta y DB.
- [x] 11. Probar `POST /api/electronic-invoicing/suppliers` sin `fiscalEmail`.
- [x] 12. Validar que `fiscalEmail` opcional no rompe creacion.
- [x] 13. Probar rechazo de duplicado por tenant + `documentNumberNormalized`.
- [x] 14. Probar `PATCH /api/electronic-invoicing/suppliers/:id`.
- [x] 15. Validar actualizacion de `legalName`, `fiscalEmail`, `fiscalStatus`, `fiscalProvider` y `fiscalLastLookupStatus`.
- [x] 16. Probar compatibilidad de `GET /api/suppliers` legacy.
- [x] 17. Validar que `purchases` conserva conteo y no quedan compras huerfanas.
- [x] 18. Ejecutar cleanup seguro y validar `fixture_rows_remaining=0`.
- [x] 19. Documentar riesgo de permiso temporal `ELECTRONIC_INVOICING_CUSTOMERS`.
- [x] 20. Crear evidencia `docs/evidencia-api-local-suppliers-fe-fase-fe-2-4E.md`.
- [x] 21. Confirmar que no se toco PRD real, servidor remoto, frontend, `backend-reporteria`, SQL/migraciones ni compras funcionales.

## Fase 3.9: FE-2.4F permiso dedicado suppliers FE

- [x] 1. Revisar patron RBAC actual de `MENU_KEYS`, `RequirePermission`, guards y seeds.
- [x] 2. Crear key `ELECTRONIC_INVOICING_SUPPLIERS`.
- [x] 3. Actualizar `ElectronicInvoicingSuppliersController` para usar `ELECTRONIC_INVOICING_SUPPLIERS`.
- [x] 4. Confirmar que `ElectronicInvoicingCustomersController` conserva `ELECTRONIC_INVOICING_CUSTOMERS`.
- [x] 5. Crear seed idempotente `scripts/database/012_seed_electronic_invoicing_suppliers_menu_permissions.sql`.
- [x] 6. Confirmar que el seed no se ejecuto.
- [x] 7. Agregar test de controller suppliers FE para validar key dedicada.
- [x] 8. Agregar test de controller customers FE para validar que customers no cambia.
- [x] 9. Ejecutar tests FE suppliers/customers.
- [x] 10. Ejecutar build de `api/`.
- [x] 11. Crear evidencia `docs/evidencia-permiso-suppliers-fe-fase-fe-2-4F.md`.
- [x] 12. Confirmar que no se toco frontend, `backend-reporteria`, migraciones estructurales, POS, ventas, compras funcionales ni reportes.

## Fase 3.10: FE-2.5 sync mock backend FE hacia api

- [x] 1. Implementar endpoint `POST /fiscal-lookup/sync`.
- [x] 2. Usar `FiscalProviderAdapter` actual con `MOCK_LOCAL`.
- [x] 3. Normalizar `documentNumber` antes de sincronizar.
- [x] 4. Soportar `partyType` `CUSTOMER` y `SUPPLIER`.
- [x] 5. Para `CUSTOMER`, buscar en `GET /api/electronic-invoicing/customers` por documento.
- [x] 6. Para `CUSTOMER`, crear con `POST /api/electronic-invoicing/customers` si no existe.
- [x] 7. Para `CUSTOMER`, actualizar con `PATCH /api/electronic-invoicing/customers/:id` si existe y requiere cambios.
- [x] 8. Para `SUPPLIER`, buscar en `GET /api/electronic-invoicing/suppliers` por documento.
- [x] 9. Para `SUPPLIER`, crear con `POST /api/electronic-invoicing/suppliers` si no existe.
- [x] 10. Para `SUPPLIER`, actualizar con `PATCH /api/electronic-invoicing/suppliers/:id` si existe y requiere cambios.
- [x] 11. Leer `API_BASE_URL` y `API_INTERNAL_TOKEN` desde variables de entorno.
- [x] 12. Fallar con error claro si `API_INTERNAL_TOKEN` no esta configurado para sync.
- [x] 13. Mantener preview sin dependencia de `api/`.
- [x] 14. Manejar `409` de `api/` como conflicto idempotente consultando nuevamente.
- [x] 15. No guardar raw response completo.
- [x] 16. No implementar DIAN real, certificados reales ni retries persistentes.
- [x] 17. Agregar tests de sync mock para customers y suppliers.
- [x] 18. Agregar test de api unavailable.
- [x] 19. Agregar test de no loggear token.
- [x] 20. Agregar test de idempotencia para evitar duplicados.
- [x] 21. Ejecutar `npm test` en `backend-facturacion-electronica`.
- [x] 22. Ejecutar `npm run build` en `backend-facturacion-electronica`.
- [x] 23. Crear evidencia `docs/evidencia-sync-mock-backend-fe-api-fase-fe-2-5.md`.
- [x] 24. Confirmar que no se modifico `api/`, `web/`, `backend-reporteria`, SQL/migraciones, PRD ni servidor remoto.

## Fase 3.11: FE-2.6 E2E sync mock backend FE hacia api

- [x] 1. Confirmar ambiente local `localhost:5432/manus_tienda_prd` y PostgreSQL `16.12`.
- [x] 2. Confirmar explicitamente que la DB usada es copia local/QA y no PRD real.
- [x] 3. Levantar `api/` local en puerto `4022`.
- [x] 4. Levantar `backend-facturacion-electronica` local con `FISCAL_PROVIDER=MOCK_LOCAL`.
- [x] 5. Usar `API_BASE_URL` apuntando a `api/` local.
- [x] 6. Usar `API_INTERNAL_TOKEN` local sin exponerlo en evidencia.
- [x] 7. Probar health de `backend-facturacion-electronica`.
- [x] 8. Probar health/version de `api/`.
- [x] 9. Ejecutar sync CUSTOMER con documento `900123456`.
- [x] 10. Validar `lookupStatus=FOUND`, `targetType=CUSTOMER` y `targetId` presente.
- [x] 11. Validar customer creado en DB con `documentNumberNormalized`, `legalName` y `fiscalEmail`.
- [x] 12. Repetir sync CUSTOMER y validar idempotencia sin duplicados.
- [x] 13. Ejecutar sync SUPPLIER con documento `900654321`.
- [x] 14. Validar `targetType=SUPPLIER` y supplier creado en DB.
- [x] 15. Repetir sync SUPPLIER y validar idempotencia sin duplicados.
- [x] 16. Validar que `purchases` conserva conteo y no quedan compras huerfanas.
- [x] 17. Probar error controlado con `API_BASE_URL` invalido y respuesta `503`.
- [x] 18. Ejecutar cleanup de fixtures y validar `fixtureRowsRemaining=0`.
- [x] 19. Invalidar sesion local E2E sin exponer token.
- [x] 20. Corregir bug minimo de DI en `FiscalLookupController` detectado durante E2E.
- [x] 21. Ejecutar `npm test` en `backend-facturacion-electronica`.
- [x] 22. Ejecutar `npm run build` en `backend-facturacion-electronica`.
- [x] 23. Crear evidencia `docs/evidencia-e2e-sync-mock-backend-fe-api-fase-fe-2-6.md`.
- [x] 24. Confirmar que no se consumio DIAN real ni certificados reales.
- [x] 25. Confirmar que no se toco frontend, `backend-reporteria`, SQL/migraciones, PRD ni servidor remoto.

## Fase 3.12: FE-3.0 diseno DIAN GetAcquirer real

- [x] 1. Analizar referencia funcional cargada de DIAN GetAcquirer y artefactos OpenSpec existentes.
- [x] 2. Documentar requerimientos tecnicos de WSDL.
- [x] 3. Documentar mapping `identificationType` e `identificationNumber`.
- [x] 4. Documentar requerimientos de certificado/keystore.
- [x] 5. Documentar requerimientos de WS-Security Signature.
- [x] 6. Documentar requerimientos de Timestamp.
- [x] 7. Documentar requerimientos de WS-A addressing.
- [x] 8. Documentar `Content-Type`/`action` para SOAP.
- [x] 9. Disenar adapter `DIAN_DIRECT` sobre `FiscalProviderAdapter`.
- [x] 10. Disenar configuracion, entrada, salida normalizada, errores, timeouts y logs seguros.
- [x] 11. Disenar variables `DIAN_WSDL_URL`, `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD`, `DIAN_ENVIRONMENT`, `DIAN_TIMEOUT_MS` y `DIAN_GET_ACQUIRER_ACTION`.
- [x] 12. Disenar seguridad: no loggear certificado/password, no guardar raw response por defecto, `requestHash` y `responseSummary`.
- [x] 13. Disenar manejo de errores: not found, timeout, certificado invalido, SOAP fault, WSDL no disponible y mapping incompleto.
- [x] 14. Disenar pruebas unitarias, integracion local con fixture XML y regla de no DIAN real en CI.
- [x] 15. Crear `docs/diseno-dian-getacquirer-real-fe-3-0.md`.
- [x] 16. Confirmar que no se consumio DIAN real ni se configuraron certificados reales.
- [x] 17. Confirmar que no se modifico codigo funcional, `api/`, frontend, SQL, PRD ni servidor remoto.

## Fase 3.13: FE-3.0R alineacion guia DIAN GetAcquirer

- [x] 1. Revisar PDF local `Guia-Herramienta-para-el-Consumo-de-Web-Services-GetAcquirer.pdf`.
- [x] 2. Confirmar que GetAcquirer permite completar informacion del adquiriente/comprador.
- [x] 3. Confirmar request con `identificationType` e `identificationNumber`.
- [x] 4. Confirmar respuesta normalizada esperada: `documentTypeCode`, `documentNumber`, `legalName` y `fiscalEmail`.
- [x] 5. Documentar campos XML relacionados: `AccountingCustomerParty`, `PartyIdentification`, `TaxRepresentativeParty`, `Contact/Name` y `Contact/ElectronicMail`.
- [x] 6. Documentar tipos de documento permitidos `11`, `12`, `13`, `21`, `22`, `31`, `41`, `42`, `47`, `48`, `50` y `91`.
- [x] 7. Documentar WSDL desde catalogo de participante DIAN.
- [x] 8. Documentar certificado/keystore, WS-Security Signature, Timestamp en milisegundos, Authentication y WS-A addressing.
- [x] 9. Confirmar `Content-Type` action `http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`.
- [x] 10. Confirmar alcance: GetAcquirer aplica a adquirientes/clientes y suppliers siguen provider-agnostic.
- [x] 11. Confirmar seguridad: no loggear certificado/password, no guardar raw response por defecto, guardar `requestHash` y `responseSummary`.
- [x] 12. Disenar pruebas con tabla de habilitacion, mock/fixtures XML/SOAP local y sin DIAN real en CI.
- [x] 13. Actualizar `docs/diseno-dian-getacquirer-real-fe-3-0.md`.
- [x] 14. Crear `docs/alineacion-guia-dian-getacquirer-fe-3-0R.md`.
- [x] 15. Actualizar `design.md` y spec OpenSpec donde aplica.
- [x] 16. Confirmar que no se implemento DIAN real, no se configuro certificado, no se modifico codigo funcional, `api/`, backend FE, frontend, SQL, PRD ni servidor remoto.

## Fase 3.14: FE-3.1 adapter DIAN_DIRECT con fixtures locales

- [x] 1. Crear `DianDirectFiscalProviderService` implementando `FiscalProviderAdapter`.
- [x] 2. Mantener `FISCAL_PROVIDER=MOCK_LOCAL` como default.
- [x] 3. Seleccionar `DIAN_DIRECT` solo cuando `FISCAL_PROVIDER=DIAN_DIRECT`.
- [x] 4. Crear fixture SOAP/XML success sintetico para GetAcquirer.
- [x] 5. Crear fixture SOAP/XML not found sintetico.
- [x] 6. Crear fixture SOAP/XML SOAP fault sintetico.
- [x] 7. Implementar `parseGetAcquirerResponse` para success, not found, SOAP fault y XML invalido.
- [x] 8. Mapear `documentTypeCode`, `documentNumberNormalized`, `legalName`, `fiscalEmail` y `lookupStatus`.
- [x] 9. Implementar `buildGetAcquirerRequest` conceptual con `identificationType` e `identificationNumber`.
- [x] 10. Dejar TODO explicitos para WS-Security Signature, Timestamp y WS-A addressing en FE-3.2.
- [x] 11. Actualizar `.env.example` con variables DIAN sin secretos y sin activar DIAN por defecto.
- [x] 12. Agregar tests de parser DIAN_DIRECT con fixtures.
- [x] 13. Agregar tests de request builder.
- [x] 14. Agregar tests de seleccion de provider y default `MOCK_LOCAL`.
- [x] 15. Confirmar que `MOCK_LOCAL` sigue pasando tests existentes.
- [x] 16. Ejecutar `npm test` en `backend-facturacion-electronica`.
- [x] 17. Ejecutar `npm run build` en `backend-facturacion-electronica`.
- [x] 18. Crear evidencia `docs/evidencia-dian-direct-adapter-fixture-fe-3-1.md`.
- [x] 19. Confirmar que no hubo llamadas externas, DIAN real, certificados reales, secretos, PRD ni servidor remoto.
- [x] 20. Confirmar que no se modifico `api/`, `web/`, `backend-reporteria`, SQL ni migraciones.

## Fase 3.15: FE-3.2 WS-Security y WS-A conceptual GetAcquirer

- [x] 1. Crear validador de configuracion DIAN para `DIAN_DIRECT`.
- [x] 2. Validar `DIAN_WSDL_URL` requerido para `DIAN_DIRECT`.
- [x] 3. Validar `DIAN_CERT_PATH` requerido para `DIAN_DIRECT`.
- [x] 4. Validar `DIAN_CERT_PASSWORD` requerido para `DIAN_DIRECT` sin exponer valor.
- [x] 5. Validar `DIAN_GET_ACQUIRER_ACTION` y default GetAcquirer.
- [x] 6. Validar `DIAN_TIMEOUT_MS` numerico positivo.
- [x] 7. Validar `DIAN_ENVIRONMENT` como `HABILITACION` o `PRODUCCION`.
- [x] 8. Confirmar que `MOCK_LOCAL` no requiere configuracion DIAN.
- [x] 9. Crear builder WS-Security conceptual con `wsse:Security`.
- [x] 10. Agregar `wsu:Timestamp`, `Created` y `Expires`.
- [x] 11. Agregar placeholders de `BinarySecurityToken` y `Signature`.
- [x] 12. Dejar TODO explicito para FE-3.3 firma real o libreria WS-Security.
- [x] 13. Crear builder WS-A conceptual con `wsa:Action`, `wsa:To` y `MessageID`.
- [x] 14. Integrar headers WS-A y WS-Security conceptuales en `buildGetAcquirerRequest`.
- [x] 15. Agregar tests de configuracion valida e invalida.
- [x] 16. Agregar tests de WS-Security Timestamp y `Expires > Created`.
- [x] 17. Agregar tests de WS-A action GetAcquirer.
- [x] 18. Agregar tests de request builder con body, WS-A y Security.
- [x] 19. Confirmar que `DIAN_DIRECT` no es default y `MOCK_LOCAL` sigue funcionando.
- [x] 20. Ejecutar `npm test` en `backend-facturacion-electronica`.
- [x] 21. Ejecutar `npm run build` en `backend-facturacion-electronica`.
- [x] 22. Actualizar README y `.env.example` sin secretos.
- [x] 23. Crear evidencia `docs/evidencia-ws-security-dian-getacquirer-fe-3-2.md`.
- [x] 24. Confirmar que no hubo DIAN real, llamadas externas, certificados reales, secretos, PRD ni servidor remoto.
- [x] 25. Confirmar que no se modifico `api/`, `web/`, `backend-reporteria`, SQL ni migraciones.

## Fase 3.16: FE-3.3 mock SOAP HTTP local GetAcquirer

- [x] 1. Crear mock SOAP server local `test/mocks/dian-get-acquirer-soap.mock-server.ts`.
- [x] 2. Levantar mock server en puerto dinamico `127.0.0.1`.
- [x] 3. Validar action GetAcquirer en request.
- [x] 4. Responder success para `identificationNumber` valido.
- [x] 5. Responder not found para documento especifico.
- [x] 6. Responder SOAP fault para documento especifico.
- [x] 7. Simular timeout para documento especifico.
- [x] 8. Implementar llamada HTTP controlada en `DIAN_DIRECT` para endpoint local.
- [x] 9. Agregar `DIAN_ENDPOINT_URL` y `DIAN_ALLOW_EXTERNAL_CALLS=false`.
- [x] 10. Bloquear endpoints externos cuando `DIAN_ALLOW_EXTERNAL_CALLS` no es `true`.
- [x] 11. Mantener `MOCK_LOCAL` como default.
- [x] 12. Agregar tests de success contra mock SOAP local.
- [x] 13. Agregar tests de envio de `identificationType` e `identificationNumber`.
- [x] 14. Agregar tests de not found, SOAP fault y timeout.
- [x] 15. Agregar test de bloqueo de endpoint externo.
- [x] 16. Agregar test de no loggear secretos.
- [x] 17. Ejecutar `npm test` en `backend-facturacion-electronica`.
- [x] 18. Ejecutar `npm run build` en `backend-facturacion-electronica`.
- [x] 19. Actualizar README y `.env.example`.
- [x] 20. Crear evidencia `docs/evidencia-mock-soap-getacquirer-fe-3-3.md`.
- [x] 21. Confirmar que no hubo DIAN real, llamadas externas, certificados reales, secretos, PRD ni servidor remoto.
- [x] 22. Confirmar que no se modifico `api/`, `web/`, `backend-reporteria`, SQL ni migraciones.

## Fase 3.17: FE-3.4 matriz readiness DIAN real y certificados

- [x] 1. Crear `docs/matriz-readiness-dian-real-certificados-fe-3-4.md`.
- [x] 2. Documentar resumen ejecutivo con estado actual, pruebas completadas y pendientes antes de DIAN real.
- [x] 3. Documentar variables requeridas: `DIAN_ENVIRONMENT`, `DIAN_WSDL_URL`, `DIAN_ENDPOINT_URL`, `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD`, `DIAN_TIMEOUT_MS`, `DIAN_GET_ACQUIRER_ACTION` y `DIAN_ALLOW_EXTERNAL_CALLS`.
- [x] 4. Documentar certificado esperado, ubicacion segura, no subir al repo, rotacion, proteccion de password y validacion segura de archivo.
- [x] 5. Documentar reglas de seguridad: no loggear password/certificado, no raw SOAP por defecto, `requestHash`, `responseSummary` y errores sanitizados.
- [x] 6. Documentar ambientes `HABILITACION` y `PRODUCCION`.
- [x] 7. Documentar bloqueo de `PRODUCCION` sin autorizacion explicita.
- [x] 8. Documentar criterios para permitir llamada externa.
- [x] 9. Documentar plan de prueba DIAN real controlada primero en `HABILITACION`.
- [x] 10. Documentar rollback operativo si falla.
- [x] 11. Documentar riesgos de certificado, WSDL, SOAP fault, timeouts, cambios DIAN, privacidad y disponibilidad.
- [x] 12. Crear checklist previa a FE-3.5.
- [x] 13. Confirmar que no se implemento firma real ni se consumio DIAN real.
- [x] 14. Confirmar que no se configuraron certificados reales.
- [x] 15. Confirmar que no se modifico codigo funcional, `api/`, `web/`, `backend-reporteria`, SQL, PRD ni servidor remoto.

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

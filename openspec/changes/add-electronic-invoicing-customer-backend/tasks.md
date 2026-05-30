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

- [ ] 1. Confirmar fuente oficial de catalogo DIAN vigente para tipos de documento.
- [ ] 2. Confirmar proveedor de consulta: DIAN directo, proveedor tecnologico o gateway dual.
- [ ] 3. Confirmar formato fiscal del consumidor final.
- [ ] 4. Confirmar si la identidad fiscal es unica por tenant o por compania futura.
- [ ] 5. Confirmar obligatoriedad de `fiscalEmail`.
- [ ] 6. Confirmar menu key y permisos.
- [ ] 7. Confirmar si se habilitara validation pipe global o validacion manual local.
- [ ] 8. Confirmar politica de logs y retencion para respuestas DIAN.
- [ ] 9. Confirmar estrategia de migracion para clientes existentes sin tipo de documento.

## Fase 2: modelo de datos futuro

- [ ] 1. Disenar migracion aditiva de `customers` para campos fiscales.
- [ ] 2. Disenar catalogo `dian_document_types`.
- [ ] 3. Disenar tabla `dian_acquirer_lookup_logs`.
- [ ] 4. Definir indices de unicidad fiscal por tenant y documento.
- [ ] 5. Definir regla fisica de consumidor final unico.
- [ ] 6. Definir campos auditables `created_by` y `updated_by`.
- [ ] 7. Definir rollback conservador sin perdida de clientes.
- [ ] 8. Definir backfill de `document_number` actual hacia `document_number_normalized`.
- [ ] 9. Definir seed idempotente del catalogo DIAN.
- [ ] 10. Definir seed de menu/permisos para el modulo nuevo.

## Fase 3: backend modulo electronic-invoicing

- [ ] 1. Crear `ElectronicInvoicingModule`.
- [ ] 2. Registrar el modulo en `AppModule`.
- [ ] 3. Crear submodulo o carpeta `customers`.
- [ ] 4. Crear entity fiscal de cliente.
- [ ] 5. Crear DTOs `CreateElectronicInvoicingCustomerDto` y `UpdateElectronicInvoicingCustomerDto`.
- [ ] 6. Crear repository tenant-aware para `customers`.
- [ ] 7. Crear service con validaciones fiscales.
- [ ] 8. Crear controller REST bajo `/api/electronic-invoicing/customers`.
- [ ] 9. Proteger endpoints con JWT, roles y permisos.
- [ ] 10. Registrar auditoria en `auditoria_eventos`.
- [ ] 11. Mantener rutas `/api/customers` sin cambios.
- [ ] 12. Agregar tests unitarios de reglas de cliente fiscal.

## Fase 4: catalogo DIAN

- [ ] 1. Crear repository de `dian_document_types`.
- [ ] 2. Crear service de catalogo.
- [ ] 3. Crear endpoint `GET /api/electronic-invoicing/document-types`.
- [ ] 4. Validar tipo de documento activo.
- [ ] 5. Validar `verificationDigit` para NIT.
- [ ] 6. Agregar tests de catalogo y validaciones.

## Fase 5: integracion DIAN GetAcquirer desacoplada

- [ ] 1. Crear `DianAcquirerGateway` como interfaz.
- [ ] 2. Crear gateway directo DIAN o gateway proveedor segun decision.
- [ ] 3. Crear `DianAcquirerService`.
- [ ] 4. Crear repository de lookup logs.
- [ ] 5. Crear endpoint preview sin persistir.
- [ ] 6. Crear endpoint lookup para cliente existente.
- [ ] 7. Crear endpoint apply con confirmacion por campo.
- [ ] 8. Soportar `DIAN_ACQUIRER_ENABLED=false`.
- [ ] 9. Registrar `dian_last_lookup_at` y `dian_last_lookup_status`.
- [ ] 10. No sobrescribir datos manuales sin `overwriteConfirmed=true`.
- [ ] 11. Agregar tests de DIAN disabled, success, not found, timeout y apply.

## Fase 6: consumidor final

- [ ] 1. Definir constantes de consumidor final aprobadas.
- [ ] 2. Crear endpoint `GET /api/electronic-invoicing/customers/default`.
- [ ] 3. Crear endpoint `POST /api/electronic-invoicing/customers/default/ensure`.
- [ ] 4. Bloquear inactivacion de consumidor final.
- [ ] 5. Bloquear borrado logico de consumidor final.
- [ ] 6. Probar que POS puede seguir usando consumidor final actual.

## Fase 7: validaciones y seguridad

- [ ] 1. Validar no duplicado por tenant, tipo y numero.
- [ ] 2. Validar email fiscal.
- [ ] 3. Validar documento requerido para no consumidor final.
- [ ] 4. Validar tenant desde JWT.
- [ ] 5. Validar permisos por menu.
- [ ] 6. Validar que `SUPER_ADMIN` no cruce tenant sin permiso explicito.
- [ ] 7. Enmascarar datos sensibles en logs.
- [ ] 8. Auditar cambios fiscales before/after.
- [ ] 9. Agregar pruebas de acceso multi-tenant.

## Fase 8: validaciones a ejecutar

- [ ] 1. Ejecutar `openspec validate add-electronic-invoicing-customer-backend --strict`.
- [ ] 2. En fase futura, ejecutar pruebas unitarias backend especificas del modulo.
- [ ] 3. En fase futura, ejecutar build de `api/`.
- [ ] 4. En fase futura, ejecutar pruebas de integracion con DIAN mock.
- [ ] 5. En fase futura, ejecutar pruebas manuales de no regresion POS con `/api/customers`.

## Guardrails

- [ ] 1. No implementar XML UBL en este cambio.
- [ ] 2. No implementar firma digital de factura en este cambio.
- [ ] 3. No generar facturas electronicas en este cambio.
- [ ] 4. No modificar frontend en esta fase.
- [ ] 5. No crear migraciones en esta fase.
- [ ] 6. No tocar produccion.
- [ ] 7. No cambiar contratos actuales de ventas, pedidos o POS sin otro OpenSpec.

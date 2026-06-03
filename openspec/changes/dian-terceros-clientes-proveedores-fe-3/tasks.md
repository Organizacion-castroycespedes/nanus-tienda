# Tasks: dian-terceros-clientes-proveedores-fe-3

## FE-3.1 diseno

- [x] 1. Analizar modelo actual de customers legacy.
- [x] 2. Analizar modelo actual de suppliers legacy.
- [x] 3. Confirmar existencia de modulo `electronic-invoicing`.
- [x] 4. Identificar endpoints actuales de customers.
- [x] 5. Identificar endpoints actuales de suppliers.
- [x] 6. Analizar como POS selecciona `customerId`.
- [x] 7. Analizar como POS muestra Consumidor Final.
- [x] 8. Analizar manejo de `tenantId`, `branchId` y usuario autenticado.
- [x] 9. Mapear campos fiscales existentes y faltantes.
- [x] 10. Alinear GetAcquirer futuro con `identificationType` e `identificationNumber`.
- [x] 11. Disenar flujo POS.
- [x] 12. Disenar flujo customers.
- [x] 13. Disenar flujo suppliers.
- [x] 14. Definir modelo recomendado.
- [x] 15. Definir reglas de no overwrite, fallback Consumidor Final y DIAN desactivable.
- [x] 16. Proponer endpoints.
- [x] 17. Definir fases FE-3.2 a FE-3.6.
- [x] 18. Documentar riesgos.
- [x] 19. Documentar decisiones pendientes.
- [x] 20. Crear `docs/diseno-dian-terceros-clientes-proveedores-fe-3-1.md`.
- [x] 21. Crear OpenSpec separado `dian-terceros-clientes-proveedores-fe-3`.
- [x] 22. Crear delta spec `dian-third-party-lookup`.

## Validacion

- [x] 1. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 2. Ejecutar `git diff --check`.

## Guardrails

- [x] 1. No implementar DIAN real.
- [x] 2. No implementar SOAP real nuevo.
- [x] 3. No tocar pricing.
- [x] 4. No tocar POS venta core.
- [x] 5. No tocar Orders.
- [x] 6. No tocar SQL funcional.
- [x] 7. No tocar PRD real.
- [x] 8. No usar remoto.
- [x] 9. No hacer commit.

## FE-3.2 backend campos fiscales

- [x] 1. Analizar tablas actuales `customers` y `suppliers`.
- [x] 2. Agregar migracion SQL idempotente para campos fiscales minimos.
- [x] 3. Agregar rollback conservador de la migracion FE-3.2.
- [x] 4. Extender types/DTOs backend de customers fiscales.
- [x] 5. Extender types/DTOs backend de suppliers fiscales.
- [x] 6. Extender repositories/services/controllers fiscales existentes.
- [x] 7. Mantener customers como entidad canonica de POS.
- [x] 8. Mantener suppliers separado y sin GetAcquirer.
- [x] 9. Evitar duplicados por tenant, tipo documento y numero.
- [x] 10. Bloquear borrado/desactivacion de Consumidor Final.
- [x] 11. Agregar tests especificos de customers/suppliers y Consumidor Final.
- [x] 12. Crear evidencia documental FE-3.2.

## Validacion FE-3.2

- [x] 1. Ejecutar tests especificos backend FE-3.2.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.3 mock DIAN customers/suppliers

- [x] 1. Analizar contrato real existente de `electronic-invoicing/customers` y `electronic-invoicing/suppliers`.
- [x] 2. Crear DTOs de lookup/apply provider-agnostic.
- [x] 3. Crear adapter mock fiscal local sin SOAP real.
- [x] 4. Agregar servicio lookup mock con env `DIAN_THIRD_PARTY_LOOKUP_ENABLED` y `DIAN_THIRD_PARTY_LOOKUP_MODE`.
- [x] 5. Agregar `POST /api/electronic-invoicing/customers/lookup`.
- [x] 6. Agregar `POST /api/electronic-invoicing/customers/:id/apply-lookup`.
- [x] 7. Agregar `POST /api/electronic-invoicing/suppliers/lookup`.
- [x] 8. Agregar `POST /api/electronic-invoicing/suppliers/:id/apply-lookup`.
- [x] 9. Implementar preview con `fieldDiffs`, resumen seguro y sin raw sensible.
- [x] 10. Implementar no overwrite: aplicar solo campos confirmados.
- [x] 11. Registrar estado mock en campos fiscales existentes.
- [x] 12. Mantener suppliers provider-agnostic y sin `GetAcquirer`.
- [x] 13. Agregar tests especificos de customers/suppliers/mock lookup.
- [x] 14. Crear evidencia documental FE-3.3.

## Validacion FE-3.3

- [x] 1. Ejecutar tests especificos backend FE-3.3.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.4 POS quick customer fiscal form

- [x] 1. Analizar POS actual, seleccion de `customerId` y fallback Consumidor Final.
- [x] 2. Crear servicios frontend para customers fiscales y lookup mock.
- [x] 3. Crear modal POS de cliente fiscal rapido.
- [x] 4. Permitir busqueda y seleccion de cliente existente.
- [x] 5. Permitir creacion rapida manual de customer fiscal.
- [x] 6. Permitir consulta mock fiscal desde POS.
- [x] 7. Mostrar preview mock y campos seleccionables.
- [x] 8. Aplicar solo campos confirmados para evitar overwrite.
- [x] 9. Seleccionar `customerId` guardado en POS para la venta.
- [x] 10. Mantener Consumidor Final como fallback y no bloquear venta.
- [x] 11. Agregar ajuste minimo backend para permiso POS en endpoints necesarios.
- [x] 12. Agregar tests especificos del ajuste de permisos.
- [x] 13. Crear evidencia documental FE-3.4.

## Validacion FE-3.4

- [x] 1. Ejecutar `cd web && npm.cmd run lint`.
- [x] 2. Ejecutar `cd web && npm.cmd run build`.
- [x] 3. Ejecutar `cd api && npm.cmd run build`.
- [x] 4. Ejecutar tests especificos backend del ajuste de permisos.
- [x] 5. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 6. Ejecutar `git diff --check`.

## FE-3.4-QA smoke local POS cliente fiscal

- [x] 1. Confirmar que web local responde en `/default/pos`.
- [x] 2. Confirmar que API local responde en `/api/system/version`.
- [ ] 3. Ejecutar smoke interactivo: abrir POS autenticado.
- [ ] 4. Ejecutar smoke interactivo: abrir modal `Cliente fiscal`.
- [ ] 5. Ejecutar smoke interactivo: validar busqueda cliente.
- [ ] 6. Ejecutar smoke interactivo: validar lookup mock DIAN.
- [ ] 7. Ejecutar smoke interactivo: aplicar campos seleccionados.
- [ ] 8. Ejecutar smoke interactivo: crear cliente rapido.
- [ ] 9. Ejecutar smoke interactivo: confirmar cliente seleccionado en POS.
- [ ] 10. Ejecutar smoke interactivo: confirmar Consumidor Final disponible.
- [x] 11. Documentar bloqueo de browser automatizado local.
- [x] 12. Crear `docs/evidencia-pos-cliente-fiscal-mock-fe-3-4-qa.md`.

## Validacion FE-3.4-QA

- [x] 1. Ejecutar `cd web && npm.cmd run build`.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.5 Skeleton GetAcquirer real SOAP/WS-Security

- [x] 1. Analizar contrato backend actual de `third-party-lookup`.
- [x] 2. Crear interface de adapters provider-agnostic.
- [x] 3. Agregar modo `real` junto a `disabled` y `mock`.
- [x] 4. Agregar config env para `DIAN_GET_ACQUIRER_*`.
- [x] 5. Validar configuracion real con errores claros y sin secretos.
- [x] 6. Crear adapter skeleton seguro para `GetAcquirer`.
- [x] 7. Preparar placeholders SOAP/WS-Security sin llamada externa.
- [x] 8. Mantener `GetAcquirer` real solo para customers/adquirientes.
- [x] 9. Mantener suppliers sin `GetAcquirer` real.
- [x] 10. Agregar tests especificos de lookup real skeleton.
- [x] 11. Actualizar `api/.env.example`.
- [x] 12. Crear `docs/evidencia-getacquirer-skeleton-fe-3-5.md`.

## Validacion FE-3.5

- [x] 1. Ejecutar tests especificos backend FE-3.5.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

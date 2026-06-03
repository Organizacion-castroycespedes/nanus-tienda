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

## FE-3.6 QA local DIAN mock desde POS

- [x] 1. Confirmar web POS local responde en `/default/pos`.
- [x] 2. Confirmar API mock local responde en `/api/system/version`.
- [x] 3. Validar `POST /api/electronic-invoicing/customers/lookup` con mock.
- [x] 4. Validar que lookup mock no expone raw SOAP ni secretos.
- [ ] 5. Validar `apply-lookup` con campos seleccionados.
- [ ] 6. Validar POS quick fiscal customer crea y selecciona customer.
- [ ] 7. Validar Consumidor Final como fallback.
- [ ] 8. Validar venta POS usando `customerId` seleccionado.
- [x] 9. Documentar bloqueo local por DB sin columnas FE-3.2.
- [x] 10. Documentar bloqueo de Browser automation local.
- [x] 11. Cleanup: detener API mock temporal y confirmar que no se creo fixture persistente.
- [x] 12. Crear `docs/evidencia-dian-mock-pos-e2e-fe-3-6.md`.

## Validacion FE-3.6

- [x] 1. Ejecutar `cd api && npm.cmd run build`.
- [x] 2. Ejecutar `cd web && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.6.1 Reintento QA DIAN mock POS con V052 local

- [x] 1. Confirmar DB local `manus_tienda_prd` en loopback.
- [x] 2. Aplicar solo `scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`.
- [x] 3. Validar columnas FE-3.2 en `customers`.
- [x] 4. Reiniciar API principal local con lookup mock.
- [x] 5. Validar lookup mock customer `FOUND`.
- [ ] 6. Validar quick fiscal create directo por `POST /electronic-invoicing/customers`.
- [x] 7. Crear customer operativo fixture seleccionable por POS.
- [x] 8. Validar `apply-lookup` con campos seleccionados sin `taxResponsibilities`.
- [x] 9. Validar customer con `isDianValidated=true` y `fiscalStatus=VALIDATED`.
- [x] 10. Validar customer disponible en listado POS `/customers`.
- [x] 11. Validar Consumidor Final sigue disponible.
- [x] 12. Validar venta POS usa `customerId` seleccionado via `/sales`.
- [x] 13. Cleanup: cancelar venta QA y soft-delete customer fixture.
- [ ] 14. Ejecutar click-smoke visual POS en browser.
- [x] 15. Documentar bugs bloqueantes y evidencia FE-3.6.1.
- [x] 16. Crear `docs/evidencia-dian-mock-pos-e2e-fe-3-6-1.md`.

## Validacion FE-3.6.1

- [x] 1. Ejecutar `cd api && npm.cmd run build`.
- [x] 2. Ejecutar `cd web && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.6.2 Fix taxResponsibilities JSONB customers

- [x] 1. Confirmar causa raiz de `taxResponsibilities` como PostgreSQL array literal.
- [x] 2. Serializar `customers.taxResponsibilities` como JSONB array en create.
- [x] 3. Serializar `customers.taxResponsibilities` como JSONB array en update/apply-lookup.
- [x] 4. Aplicar fix equivalente en suppliers por mismo patron.
- [x] 5. Agregar tests repository customers para create/update JSONB.
- [x] 6. Agregar tests repository suppliers para create/update JSONB.
- [x] 7. Ejecutar tests especificos customers/suppliers.
- [x] 8. Verificar smoke API local: fiscal create con `taxResponsibilities`.
- [x] 9. Verificar smoke API local: apply-lookup seleccionando `taxResponsibilities`.
- [x] 10. Cleanup fixture local del smoke.
- [x] 11. Crear `docs/evidencia-tax-responsibilities-jsonb-fe-3-6-2.md`.

## Validacion FE-3.6.2

- [x] 1. Ejecutar `cd api && npm.cmd run build`.
- [x] 2. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 3. Ejecutar `git diff --check`.

## FE-3.6.3 QA final mock customers POS

- [x] 1. Confirmar API local disponible en `4020`.
- [x] 2. Confirmar lookup mock por respuesta `MOCK_LOCAL`.
- [x] 3. Crear customer fiscal con `taxResponsibilities`.
- [x] 4. Validar lookup mock `FOUND`.
- [x] 5. Validar `apply-lookup` seleccionando `taxResponsibilities`.
- [x] 6. Verificar API devuelve `taxResponsibilities` como array.
- [x] 7. Verificar DB guarda `taxResponsibilities` como JSONB array valido.
- [x] 8. Validar POS usa `customerId` via `/customers`, `/pos/session`, `/sales`.
- [x] 9. Validar Consumidor Final fallback.
- [x] 10. Cleanup: cancelar venta QA y soft-delete customer fixture.
- [x] 11. Crear `docs/evidencia-dian-mock-pos-e2e-final-fe-3-6-3.md`.

## Validacion FE-3.6.3

- [x] 1. Ejecutar `cd api && npm.cmd run build`.
- [x] 2. Ejecutar `cd web && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.7.1 Seleccion tecnica SOAP/XML Signature GetAcquirer

- [x] 1. Analizar skeleton `third-party-lookup.get-acquirer-adapter.ts`.
- [x] 2. Analizar config existente `DIAN_GET_ACQUIRER_*`.
- [x] 3. Analizar estructura esperada `GetAcquirer`.
- [x] 4. Documentar necesidades SOAP envelope, WS-A, WS-Security, Timestamp, BinarySecurityToken y Signature.
- [x] 5. Investigar librerias candidatas Node.js/TypeScript.
- [x] 6. Documentar estrategia de pruebas con fixtures.
- [x] 7. Documentar riesgos de seguridad.
- [x] 8. Crear `docs/diseno-getacquirer-soap-wssecurity-fe-3-7-1.md`.
- [x] 9. Confirmar fuera de alcance: sin DIAN real, sin certificados reales, sin install, sin PRD, sin remoto y sin commit.

## Validacion FE-3.7.1

- [x] 1. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 2. Ejecutar `git diff --check`.

## FE-3.7.2 Dependency spike GetAcquirer sin DIAN real

- [x] 1. Agregar dependencias `xml-crypto`, `@xmldom/xmldom`, `node-forge` y `fast-xml-parser` en `api`.
- [x] 2. Crear fixture XML SOAP local seguro para GetAcquirer.
- [x] 3. Agregar test de imports de dependencias.
- [x] 4. Agregar test de parseo XML con `@xmldom/xmldom`.
- [x] 5. Agregar test de construccion basica `SignedXml` sin firmar DIAN real.
- [x] 6. Agregar test de parseo SOAP con `fast-xml-parser`.
- [x] 7. Dejar test P12/PFX pendiente por falta de fixture aprobado y por prohibicion de certificado real.
- [x] 8. Crear `docs/evidencia-getacquirer-dependency-spike-fe-3-7-2.md`.
- [x] 9. Confirmar fuera de alcance: sin DIAN real, sin certificado real, sin password real, sin llamada externa, sin PRD, sin remoto y sin commit.

## Validacion FE-3.7.2

- [x] 1. Ejecutar `cd api && npm.cmd install xml-crypto @xmldom/xmldom node-forge fast-xml-parser`.
- [x] 2. Ejecutar tests especificos FE-3.7.2.
- [x] 3. Ejecutar `cd api && npm.cmd run build`.
- [x] 4. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 5. Ejecutar `git diff --check`.

## FE-3.7.3 GetAcquirer request builder con fixtures

- [x] 1. Crear request builder GetAcquirer en backend `third-party-lookup`.
- [x] 2. Generar SOAP Envelope con namespaces claros.
- [x] 3. Generar headers WS-Addressing `Action`, `To` y `MessageID`.
- [x] 4. Generar `wsse:Security` con `wsu:Timestamp` placeholder.
- [x] 5. Generar body `GetAcquirer` con `identificationType` e `identificationNumber`.
- [x] 6. Agregar IDs estables para futura firma de Body/Timestamp/WS-A.
- [x] 7. Crear fixture XML esperado `get-acquirer-basic-request.xml`.
- [x] 8. Agregar tests unitarios del request builder y parseo con `@xmldom/xmldom`.
- [x] 9. Confirmar que no incluye firma real, certificado, password ni llamada externa.
- [x] 10. Crear `docs/evidencia-getacquirer-request-builder-fe-3-7-3.md`.

## Validacion FE-3.7.3

- [x] 1. Ejecutar tests especificos FE-3.7.3.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.7.4 Firma XML local GetAcquirer con certificado fixture

- [x] 1. Crear helper signer XML local para GetAcquirer.
- [x] 2. Generar certificado fixture self-signed TEST ONLY en runtime de tests.
- [x] 3. Firmar `soap:Body` con referencia `#Body-1`.
- [x] 4. Firmar `wsu:Timestamp` con referencia `#Timestamp-1`.
- [x] 5. Insertar `ds:Signature` dentro de `wsse:Security`.
- [x] 6. Validar firma localmente con certificado fixture.
- [x] 7. Confirmar que no se expone private key ni password real.
- [x] 8. Mantener suppliers fuera de GetAcquirer real.
- [x] 9. Crear tests unitarios FE-3.7.4.
- [x] 10. Crear `docs/evidencia-getacquirer-xml-signature-fixture-fe-3-7-4.md`.

## Validacion FE-3.7.4

- [x] 1. Ejecutar tests especificos FE-3.7.4.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

## FE-3.7.5 BinarySecurityToken y SOAP firmado completo con fixture

- [x] 1. Agregar `wsse:BinarySecurityToken` TEST ONLY al SOAP firmado.
- [x] 2. Usar ID estable `BinarySecurityToken-1`.
- [x] 3. Agregar `ds:KeyInfo` con `wsse:SecurityTokenReference`.
- [x] 4. Apuntar `SecurityTokenReference` a `#BinarySecurityToken-1`.
- [x] 5. Mantener referencias firmadas `#Body-1` y `#Timestamp-1`.
- [x] 6. Validar firma local con certificado fixture.
- [x] 7. Confirmar que private key y password no quedan en XML ni repo.
- [x] 8. Mantener suppliers fuera de GetAcquirer real.
- [x] 9. Actualizar tests unitarios del signer.
- [x] 10. Crear `docs/evidencia-getacquirer-binary-security-token-fe-3-7-5.md`.

## Validacion FE-3.7.5

- [x] 1. Ejecutar tests especificos FE-3.7.5.
- [x] 2. Ejecutar `cd api && npm.cmd run build`.
- [x] 3. Ejecutar `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`.
- [x] 4. Ejecutar `git diff --check`.

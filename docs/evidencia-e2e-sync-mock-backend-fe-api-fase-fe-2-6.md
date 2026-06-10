# Evidencia E2E sync mock backend FE -> api - Fase FE-2.6

## Objetivo

Validar localmente el flujo end-to-end de sincronizacion fiscal mock desde `backend-facturacion-electronica` hacia `api/` para `customers` y `suppliers`, sin DIAN real, sin certificados reales y sin tocar PRD real.

## Ambiente usado

- Fecha local de prueba: 2026-05-31.
- Base de datos: `localhost:5432/manus_tienda_prd`.
- Confirmacion: copia local/QA de PRD, no PRD real.
- PostgreSQL: `PostgreSQL 16.12`.
- `api/`: `http://localhost:4022`.
- `backend-facturacion-electronica`: `http://localhost:4031`.
- Puerto `4030`: ya estaba ocupado por otro proceso local y se dejo intacto.
- Proveedor fiscal: `FISCAL_PROVIDER=MOCK_LOCAL`.
- `API_BASE_URL`: apuntando a `http://localhost:4022`.
- `API_INTERNAL_TOKEN`: token local de prueba, no expuesto.

## Health

- `GET http://localhost:4022/api/system/version`: `200`.
- `GET http://localhost:4031/health`: `status=ok`, `service=backend-facturacion-electronica`.

## Conteos antes

- `customers`: 2.
- `suppliers`: 5.
- `purchases`: 15.
- `purchases` huerfanas por `supplier_id`: 0.
- Fixture customer `documentNumberNormalized=900123456`: 0.
- Fixture supplier `documentNumberNormalized=900654321`: 0.

## CUSTOMER sync

Payload sanitizado:

```json
{
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumber": "900123456"
}
```

Primer llamado:

- `provider`: `MOCK_LOCAL`.
- `lookupStatus`: `FOUND`.
- `syncAction`: `CREATE`.
- `targetType`: `CUSTOMER`.
- `targetId`: presente.
- `documentNumberNormalized`: `900123456`.
- `message`: `customer created from mock lookup`.

Validacion DB:

- Fila creada: 1.
- `document_type_code`: `31`.
- `document_number_normalized`: `900123456`.
- `legal_name`: `Cliente Mock 900123456`.
- `fiscal_email`: `cliente.mock@example.com`.
- `fiscal_status`: `VALIDATED`.

## Idempotencia CUSTOMER

Segundo llamado con el mismo payload:

- `lookupStatus`: `FOUND`.
- `syncAction`: `SKIP`.
- `targetType`: `CUSTOMER`.
- `targetId`: igual al primer llamado.
- No se duplico customer.

Resultado: OK.

## SUPPLIER sync

Payload sanitizado:

```json
{
  "partyType": "SUPPLIER",
  "documentTypeCode": "31",
  "documentNumber": "900654321"
}
```

Primer llamado:

- `provider`: `MOCK_LOCAL`.
- `lookupStatus`: `FOUND`.
- `syncAction`: `CREATE`.
- `targetType`: `SUPPLIER`.
- `targetId`: presente.
- `documentNumberNormalized`: `900654321`.
- `message`: `supplier created from mock lookup`.

Validacion DB:

- Fila creada: 1.
- `document_type_code`: `31`.
- `document_number_normalized`: `900654321`.
- `legal_name`: `Proveedor Mock 900654321`.
- `fiscal_email`: `proveedor.mock@example.com`.
- `fiscal_status`: `VALIDATED`.
- `fiscal_provider`: `MOCK_LOCAL`.
- `fiscal_last_lookup_status`: `FOUND`.

## Idempotencia SUPPLIER

Segundo llamado con el mismo payload:

- `lookupStatus`: `FOUND`.
- `syncAction`: `UPDATE`.
- `targetType`: `SUPPLIER`.
- `targetId`: igual al primer llamado.
- No se duplico supplier.

Resultado: OK.

## Compatibilidad purchases

- `purchases` antes: 15.
- `purchases` despues de sync: 15.
- `purchases` huerfanas despues de sync: 0.
- No se modifico `PurchaseService`.
- No se modifico `PurchaseController`.

## Error controlado

Se levanto una instancia temporal de `backend-facturacion-electronica` en `http://localhost:4032` con:

- `API_BASE_URL=http://localhost:4999`.
- `FISCAL_PROVIDER=MOCK_LOCAL`.
- `API_INTERNAL_TOKEN`: valor local dummy, no secreto real.

Resultado:

- `POST /fiscal-lookup/sync`: `503`.
- El fallo no se oculto.
- No se consumio DIAN real.
- No se uso certificado real.

## Cleanup

Acciones:

- Se eliminaron los fixtures creados por documento normalizado.
- Se invalidaron sesiones locales de prueba con `user_agent='Codex E2E FE-2.6'`.
- Se detuvo la instancia temporal de error controlado.
- Se detuvieron las instancias locales levantadas para la prueba en puertos `4022`, `4031` y `4032`.

Validacion final:

- `customerFixtureRowsRemaining`: 0.
- `supplierFixtureRowsRemaining`: 0.
- `activeE2eSessions`: 0.
- `customers`: 2.
- `suppliers`: 5.
- `purchases`: 15.
- `orphanPurchases`: 0.
- Puertos `4022`, `4031` y `4032`: cerrados despues de la prueba.

Nota: el resumen inicial del script marco `cleanupOk=false` por una lectura posterior inconsistente, pero la validacion directa final contra DB confirmo cero fixtures y conteos base intactos.

## Bug minimo corregido

Durante la prueba real, `POST /fiscal-lookup/sync` fallo con error runtime porque `syncService` llegaba `undefined` en `FiscalLookupController`.

Correccion minima aplicada:

- `backend-facturacion-electronica/src/modules/fiscal-lookup/fiscal-lookup.controller.ts`
- Se agrego `@Inject(SyncService)` al parametro `syncService`.

Resultado:

- Endpoint `/fiscal-lookup/sync` quedo operativo.
- Tests unitarios siguen pasando.
- Build sigue pasando.

## Comandos ejecutados

Sin secretos en salida:

- Levantar `api/` local en puerto `4022`.
- Levantar `backend-facturacion-electronica` local en puerto `4031`.
- `GET /api/system/version`.
- `GET /health`.
- `POST /fiscal-lookup/sync` para CUSTOMER.
- `POST /fiscal-lookup/sync` para SUPPLIER.
- Prueba de error controlado con `API_BASE_URL` invalido.
- Cleanup local de fixtures y sesion E2E.
- `npm.cmd test` en `backend-facturacion-electronica`.
- `npm.cmd run build` en `backend-facturacion-electronica`.

## Validaciones ejecutadas

- `backend-facturacion-electronica npm test`: 15 tests pasan.
- `backend-facturacion-electronica npm run build`: pasa.
- `openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json`: pasa.
- `git diff --check`: pasa, solo warnings de LF/CRLF existentes en Windows.

## Riesgos vivos

- El flujo aun usa `MOCK_LOCAL`; falta DIAN/GetAcquirer real.
- La autenticacion interna usa token local; falta cerrar estrategia productiva de autenticacion servicio-a-servicio.
- Falta definir observabilidad persistente de sync, retries y auditoria tecnica.
- Falta endurecer respuesta de error para incluir mensaje operativo seguro en cliente HTTP cuando aplique.

## Proximos pasos

- Disenar provider DIAN/GetAcquirer real.
- Definir contrato productivo de autenticacion interna entre servicios.
- Disenar logs persistentes de sincronizacion fiscal.
- Definir retries y trazabilidad para fallos de api interna.

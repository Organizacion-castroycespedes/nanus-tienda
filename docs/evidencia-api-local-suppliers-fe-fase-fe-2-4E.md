# Evidencia API local suppliers FE - Fase FE-2.4E

## Objetivo

Validar por API local real los endpoints fiscales de proveedores bajo `/api/electronic-invoicing/suppliers`, manteniendo compatibilidad con `/api/suppliers` y `purchases`.

## Ambiente usado

- Fecha de ejecucion: 2026-05-31.
- API local probada: `http://localhost:4022`.
- DB host: `localhost`.
- DB port: `5432`.
- DB name: `manus_tienda_prd`.
- PostgreSQL: `PostgreSQL 16.12`.
- Conexion PostgreSQL: loopback local `::1/128`.
- Confirmacion: es copia local/QA local de PRD. No se toco PRD real ni servidor remoto.

Nota operativa: habia una instancia local previa en `http://localhost:4020` que respondia `/api/system/version`, pero no exponia la ruta nueva de suppliers FE. Para probar el codigo actual, se levanto una instancia dev local separada en `4022` contra la misma DB local.

## Token local

- Se genero un token local de QA para usuario local `SUPER_ADMIN`.
- El token no se imprimio ni se guardo en evidencia.
- Se creo una sesion local temporal en `auth_sessions`.
- La sesion temporal fue invalidada al terminar la prueba.

## Conteos base

| Metrica | Antes | Despues de operaciones | Despues de cleanup |
| --- | ---: | ---: | ---: |
| `suppliers` | 5 | 7 | 5 |
| `purchases` | 15 | 15 | 15 |
| `purchases` huerfanas | 0 | 0 | 0 |
| fixtures `QA FE 2.4E %` | 0 | 2 | 0 |

Pre-cleanup seguro: `0` filas eliminadas.

## Endpoints probados

### `GET /api/electronic-invoicing/suppliers`

Resultado: PASS.

- Respondio lista.
- Conteo devuelto en validacion corregida: `5`.
- Incluyo campos fiscales esperados:
  - `id`
  - `tenantId`
  - `name`
  - `documentNumber`
  - `documentTypeCode`
  - `documentNumberNormalized`
  - `verificationDigit`
  - `legalName`
  - `fiscalEmail`
  - `fiscalStatus`
  - `fiscalProvider`
  - `fiscalLastLookupAt`
  - `fiscalLastLookupStatus`
  - `isActive`
  - `createdAt`
  - `updatedAt`

Filtros probados:

| Filtro | Resultado |
| --- | ---: |
| `search` | 1 fila fixture |
| `documentNumber` | 1 fila fixture |
| `fiscalStatus=FAILED` | 1 fila fixture |
| `isActive=true` | PASS |

### `POST /api/electronic-invoicing/suppliers` con `fiscalEmail`

Payload sanitizado:

```json
{
  "name": "QA FE 2.4E Supplier <stamp>",
  "documentNumber": "900.244-<stamp>-1",
  "documentTypeCode": "31",
  "verificationDigit": "7",
  "legalName": "QA FE 2.4E Supplier SAS <stamp>",
  "fiscalEmail": "qa.fe24e.supplier.<stamp>@example.test",
  "fiscalStatus": "VALIDATED"
}
```

Resultado: PASS.

- `documentNumberNormalized`: `900244202605311909401`.
- `fiscalEmail`: guardado en minusculas.
- `fiscalStatus`: `VALIDATED`.
- DB reflejo el registro.

### `POST /api/electronic-invoicing/suppliers` sin `fiscalEmail`

Payload sanitizado:

```json
{
  "name": "QA FE 2.4E Supplier Sin Email <stamp>",
  "documentNumber": "900.244-<stamp>-2",
  "documentTypeCode": "31",
  "fiscalStatus": "PENDING"
}
```

Resultado: PASS.

- `fiscalEmail`: `null`.
- `documentNumberNormalized`: `900244202605311909402`.
- `fiscalStatus`: `PENDING`.
- Confirma que `fiscalEmail` sigue opcional.

### Duplicado por documento normalizado

Payload sanitizado:

```json
{
  "name": "QA FE 2.4E Supplier Duplicado <stamp>",
  "documentNumber": "900.244-<stamp>-1",
  "documentTypeCode": "31",
  "fiscalStatus": "PENDING"
}
```

Resultado: PASS.

- HTTP status: `409 Conflict`.
- El backend rechazo duplicado por `tenant_id + document_number_normalized`.
- No se creo fila adicional.

### `PATCH /api/electronic-invoicing/suppliers/:id`

Payload sanitizado:

```json
{
  "legalName": "QA FE 2.4E Supplier Updated SAS <stamp>",
  "fiscalEmail": "qa.fe24e.updated.<stamp>@example.test",
  "fiscalStatus": "FAILED",
  "fiscalProvider": "MOCK_LOCAL",
  "fiscalLastLookupStatus": "FOUND"
}
```

Resultado: PASS.

- `legalName`: actualizado.
- `fiscalEmail`: actualizado.
- `fiscalStatus`: `FAILED`.
- `fiscalProvider`: `MOCK_LOCAL`.
- `fiscalLastLookupStatus`: `FOUND`.
- `GET` con filtros devolvio el cambio.
- DB reflejo el cambio.

## Queries de validacion

Ambiente:

```sql
SELECT
  current_database(),
  inet_server_addr(),
  inet_server_port(),
  version();
```

Conteos:

```sql
SELECT count(*) FROM suppliers;
SELECT count(*) FROM purchases;
SELECT count(*)
FROM purchases p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.supplier_id IS NOT NULL
  AND s.id IS NULL;
```

Validacion fixture:

```sql
SELECT
  id,
  document_number_normalized,
  fiscal_email,
  fiscal_status,
  fiscal_provider,
  fiscal_last_lookup_status
FROM suppliers
WHERE id IN ('<fixture-1>', '<fixture-2>');
```

Cleanup seguro:

```sql
DELETE FROM suppliers s
WHERE s.id IN ('<fixture-1>', '<fixture-2>')
  AND s.name LIKE 'QA FE 2.4E %'
  AND NOT EXISTS (
    SELECT 1
    FROM purchases p
    WHERE p.supplier_id = s.id
  );
```

## Compatibilidad

### `/api/suppliers` legacy

Resultado: PASS.

- `GET /api/suppliers` respondio correctamente con token local.
- No se modifico controller/service legacy.
- No se crearon endpoints legacy nuevos.

### `purchases`

Resultado: PASS.

- Conteo antes: `15`.
- Conteo despues de operaciones: `15`.
- Conteo despues de cleanup: `15`.
- Compras huerfanas despues de cleanup: `0`.
- No se modifico `purchases.supplier_id`.
- No se alteraron compras existentes.

## Cleanup

Resultado: PASS.

- Fixtures creados: `2`.
- Fixtures eliminados: `2`.
- `fixture_rows_remaining`: `0`.
- Sesion QA local invalidada.

## Riesgo vivo: permiso temporal

Los endpoints FE suppliers siguen protegidos temporalmente con `ELECTRONIC_INVOICING_CUSTOMERS`.

Recomendacion para siguiente fase:

- Crear menu key dedicada `ELECTRONIC_INVOICING_SUPPLIERS`.
- Sembrar permisos READ/WRITE.
- Cambiar el guard de suppliers FE para usar la key dedicada.
- Ejecutar prueba de acceso con usuario no `SUPER_ADMIN`.

## Resultado general

FE-2.4E PASS.

- `GET`, `POST` y `PATCH` funcionan en API local real.
- Duplicados por documento normalizado se rechazan.
- `fiscalEmail` opcional funciona.
- `/api/suppliers` legacy no se rompe.
- `purchases` no se rompe.
- Cleanup pasa.
- No se toco PRD real.
- No se toco servidor remoto.
- No se toco frontend.
- No se toco `backend-reporteria`.
- No se modifico SQL ni migraciones.

## Proximos pasos

1. Crear permiso dedicado `ELECTRONIC_INVOICING_SUPPLIERS`.
2. Ejecutar prueba de permisos READ/WRITE con usuario no `SUPER_ADMIN`.
3. Disenar integracion `backend-facturacion-electronica -> api` para upsert fiscal de suppliers.
4. Definir fuente fiscal provider-agnostic para suppliers.

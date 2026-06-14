# Evidencia QA - USER ticket pedidos reporteria

Fecha: 2026-06-13
Rama: `feat/develop/mejoras-funcionales-operativas`

## Objetivo

Permitir que rol `USER` pueda visualizar, descargar e imprimir el PDF de ticket de pedidos desde:

`GET /api/reports/order-sales/:orderSaleId/ticket`

sin abrir acceso global y manteniendo validacion por tenant, sucursal y contexto operativo.

## Cambios validados

- `ReportAuthzGuard` mantiene roles administrativos por defecto.
- `GET /api/reports/order-sales/:orderId/ticket` declara acceso explicito para `USER`.
- La funcion SQL `report_order_sale_ticket` sigue resolviendo tenant, sucursal y restriccion por usuario.
- Si la funcion SQL devuelve `NULL` para un pedido existente, el servicio responde `403 Forbidden`.

## Pruebas automatizadas

Comando:

```powershell
npx.cmd tsx --test src/modules/auth/report-authz.guard.spec.ts src/modules/reports/orders-reports.service.spec.ts
```

Resultado:

```text
tests 9
pass 9
fail 0
```

Casos cubiertos:

- `USER` autorizado: PASS.
- `USER` otro tenant: `ForbiddenException`.
- `USER` sucursal no autorizada: `ForbiddenException`.
- `ADMIN` autorizado: PASS.
- `SUPER_USER` tenant autorizado: PASS.

## Build

Comando:

```powershell
npm.cmd run build
```

Resultado: PASS.

## OpenSpec

Comando:

```powershell
openspec.cmd validate mvp-web-hardening
```

Resultado:

```text
Change 'mvp-web-hardening' is valid
```

## Curl local con JWT USER

Se levanto una instancia local temporal de `backend-reporteria` en `http://localhost:4100`.
Se genero un JWT local de corta duracion con rol `USER`; el token no se registro.

Request:

```text
GET http://localhost:4100/api/reports/order-sales/2fa36f6a-e26b-47a7-9dfb-0da1c4130ede/ticket
Authorization: Bearer <USER_JWT_LOCAL>
Accept: application/pdf
```

Resultado:

```json
{
  "httpStatus": 200,
  "contentType": "application/pdf",
  "bytes": 3087,
  "orderId": "2fa36f6a-e26b-47a7-9dfb-0da1c4130ede",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "branchId": "ab41d3da-6686-4de3-9191-875a5a7da5a5",
  "userId": "c78f123b-c672-4277-a2d0-eb580d68c544"
}
```

Estado final: PASS.

# Evidencia QA - Filtro turno actual multisucursal

## Rama y HEAD

- Rama: `feat/develop/mejora-operativa-turno-actual-rol-super-user`
- HEAD inicial: `dceb15e Merge pull request #76 from Organizacion-castroycespedes/release/evolutivo/0.0.1`
- Fecha local: 2026-06-19

## Problema

`/{tenant}/finance/current-shift` mostraba una sola sesion abierta resuelta por backend. Para `SUPER_USER`, si el tenant tenia varias cajas abiertas, la pantalla no daba forma clara de escoger sucursal, terminal, caja o sesion.

## Solucion aplicada

- Se mantiene `GET /api/reports/current-shift`.
- Se agrega `availableCashSessions` a la respuesta.
- Se agregan filtros de contrato: `terminalId` y `cashRegisterId`; se conservan `tenantId`, `branchId`, `cashSessionId`, `page`, `pageSize` y `search`.
- El backend lista solo sesiones `OPEN` dentro del tenant y scope del actor.
- La UI muestra selector cuando hay multiples cajas abiertas y contexto explicito cuando hay una sola.
- Al seleccionar una sesion, la UI consulta de nuevo con `cashSessionId`.
- No se cambio SQL.
- No se cambio matriz de permisos.

## Contrato API

Endpoint:

```http
GET /api/reports/current-shift?tenantId=...&cashSessionId=...&branchId=...&terminalId=...&cashRegisterId=...&pageSize=50
```

Campos nuevos o ampliados:

```json
{
  "availableCashSessions": [
    {
      "id": "...",
      "tenantId": "...",
      "branchId": "...",
      "branchName": "...",
      "terminalId": "...",
      "terminalName": "...",
      "cashRegisterId": "...",
      "cashRegisterName": "...",
      "cashRegisterCode": "...",
      "userId": "...",
      "userName": "...",
      "openedAt": "...",
      "status": "OPEN"
    }
  ],
  "filters": {
    "tenantId": "...",
    "branchId": "...",
    "terminalId": "...",
    "cashRegisterId": "...",
    "cashSessionId": "..."
  }
}
```

## Reglas por rol

- `USER`: solo ve sesiones abiertas propias autorizadas. No puede seleccionar caja ajena.
- `ADMIN`: se conserva comportamiento limitado; no se amplio matriz de permisos.
- `SUPER_USER`: puede ver sesiones abiertas del tenant y seleccionar una por `cashSessionId`.
- `SUPER_ADMIN`: mantiene aislamiento por `tenantId`.

## Archivos modificados

- `backend-reporteria/src/modules/reports/current-shift-reports.service.ts`
- `backend-reporteria/src/modules/reports/current-shift-reports.service.spec.ts`
- `backend-reporteria/src/modules/reports/types/current-shift-report.types.ts`
- `web/app/[tenant]/finance/current-shift/page.tsx`
- `web/modules/reporteria/current-shift-session-options.ts`
- `web/modules/reporteria/current-shift-session-options.spec.ts`
- `web/modules/reporteria/services/reporting.service.ts`
- `web/modules/reporteria/types.ts`
- `openspec/changes/mejorar-filtro-turno-actual-multisucursal/*`

## Casos QA

- `USER` con una caja propia: PASS manual.
- `SUPER_USER` con una caja abierta: PASS manual.
- `SUPER_USER` con multiples cajas abiertas: PASS manual.
- `SUPER_USER` seleccionando otra sucursal/terminal/caja: PASS manual.
- Sin cajas abiertas: PASS manual.
- Intento de seleccionar sesion fuera de alcance: PASS manual.
- Sesiones cerradas: cubierto por test backend; no aparecen como opciones activas.

## QA manual

Estado: PASS.

Validacion realizada sobre:

- `USER` con una caja propia.
- `SUPER_USER` con una caja abierta.
- `SUPER_USER` con multiples cajas abiertas.
- Seleccion de otra sucursal, terminal y caja.
- Estado sin cajas abiertas.
- Intento fuera de alcance.

Resultado:

- La pantalla `/finance/current-shift` muestra correctamente el turno actual.
- Para `SUPER_USER`, cuando existen varias cajas abiertas, aparece selector de sesion/caja.
- Al cambiar sucursal/terminal/caja, se actualiza la informacion del reporte correctamente.
- No se evidencia fuga cross-tenant ni acceso fuera de alcance.
- No se detectan regresiones en resumen, ventas, pedidos, compras, movimientos, arqueos ni tickets.
- Responsive validado manualmente.

## Validaciones ejecutadas

- `openspec.cmd validate mejorar-filtro-turno-actual-multisucursal --type change --strict`: PASS
- `openspec.cmd validate --all --strict`: PASS
- `cd backend-reporteria; npx.cmd tsx --test src/modules/reports/current-shift-reports.service.spec.ts src/modules/reports/current-shift-reports.controller.spec.ts`: PASS
- `cd backend-reporteria; npm.cmd run build`: PASS
- `cd api; npm.cmd run build`: PASS
- `cd web; npx.cmd tsx --test modules/reporteria/current-shift-session-options.spec.ts`: PASS
- `cd web; npm.cmd run lint`: PASS con warnings preexistentes en archivos no tocados.
- `cd web; npm.cmd run build`: PASS con warnings preexistentes y aviso de Browserslist desactualizado.
- `Invoke-WebRequest -UseBasicParsing http://localhost:4051/00000000-0000-0000-0000-000000000001/finance/current-shift`: PASS, HTTP 200 en dev server local.
- `git diff --check`: PASS con avisos LF/CRLF.
- `git status --short`: PASS, solo cambios locales de esta tarea.

## Validaciones no ejecutadas

- `cd api; npx.cmd tsx --test <tests relacionados>`: no se ejecuto porque no hubo cambios en `api` ni tests relacionados al endpoint, que vive en `backend-reporteria`.
- Smoke visual con Browser in-app: no se pudo ejecutar porque el runtime del Browser fallo dos veces con `windows sandbox failed: spawn setup refresh`.

## Riesgos conocidos

- No hay harness React para probar render real de `CurrentShiftPage`; se agrego prueba auxiliar de labels/filtro y se valida con lint/build.
- La verificacion visual en Browser in-app quedo bloqueada por fallo de runtime; se hizo smoke HTTP local en `http://localhost:4051`.
- Si un tenant llega a tener mas de 100 cajas abiertas simultaneas, el listado backend queda limitado a 100 opciones. Esto evita respuesta enorme y puede requerir paginacion futura.

## Resultado final

Implementacion local completa. QA manual PASS.

## Commit

No se hizo commit.

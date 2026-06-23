# Electron POS cash-session QA context

Fecha: 2026-06-21  
OpenSpec change: `diagnosticar-contexto-caja-terminal-qa-pos-electron`

## Objetivo

Diagnosticar por que Electron empaquetado puede llegar a login, dashboard y POS, pero el flujo real de caja/sesion bloquea la QA del lector HID.

## Bloqueo observado

Mensajes exactos vistos en runtime:

- `La caja ya tiene una sesion abierta`
- `No hay cajas abiertas para el alcance seleccionado.`
- `No tienes una sesion abierta en este momento.`
- `No hay caja abierta para el contexto operativo actual.`

## Rutas y endpoints revisados

- `web/domains/pos/components/PosContextSelector.tsx`
- `web/modules/finance/services/finance.service.ts`
- `web/app/[tenant]/pos/select-context/page.tsx`
- `web/app/[tenant]/finance/current-shift/page.tsx`
- `web/app/[tenant]/finance/cash-sessions/page.tsx`
- `api/src/modules/finance/cash-sessions/cash-sessions.service.ts`
- `backend-reporteria/src/modules/reports/current-shift-reports.service.ts`

## Modelo conceptual

La ruta operativa es:

`auth user -> tenant -> branch -> terminal -> cash register -> cash session -> pos session`

En el flujo POS, `PosContextSelector`:

- carga cajas con `listCashRegisters()`
- revisa la sesion actual con `getCurrentCashSession()`
- abre caja con `openCashSession()`
- crea la sesion POS con `createPosSessionRequest()`

En backend:

- `cash-sessions.open` valida caja abierta por register y por usuario.
- `current-shift` usa su propio scope de sesion abierta disponible.

## Posibles causas

1. La caja ya tiene una sesion abierta para el register seleccionado, pero no coincide con el scope actual del usuario.
2. La sesion abierta existe para otra terminal o para otro alcance de sucursal.
3. `current-shift` y `cash-sessions` usan filtros distintos y por eso reportan estados que parecen contradictorios.
4. El usuario QA tiene contexto valido para login y POS, pero no para operar caja en la terminal seleccionada.

## Evidencia encontrada

- Electron empaquetado abre.
- Login QA seguro funciona.
- Dashboard carga.
- POS carga.
- El flujo de apertura de caja desde POS devuelve `400` con `La caja ya tiene una sesion abierta`.
- `finance/current-shift` muestra `No hay cajas abiertas para el alcance seleccionado.`
- `finance/cash-sessions` muestra `No tienes una sesion abierta en este momento.`

## Recomendacion segura

Usar un usuario QA con una combinacion conocida de tenant, branch, terminal y caja que tenga sesion operativa consistente, o hacer una correccion UI-only autorizada para cerrar/reabrir la sesion desde el flujo normal.

La correccion por SQL queda para una fase aparte y aprobada.

## Fuera de alcance

- Cambios de backend.
- SQL destructivo.
- Permisos.
- Reglas de negocio.
- Fix de scanner HID.
- Electron main/preload.
- USB/serial.

## Proxima fase recomendada

Definir un setup QA repetible para caja y terminal, o arreglar la incoherencia de scope entre POS y reporteria en una fase separada.


# Matriz de evidencias frontend POS — B4.2

| Hallazgo | Archivo y líneas | Estado |
|---|---|---|
| Pantalla y estado local POS | `web/modules/pos/components/PosScreen.tsx:540-630` | Confirmado |
| Contexto requerido | `web/domains/pos/hooks/useRequirePosSession.ts:18-46` | Confirmado |
| Persistencia de contexto | `web/store/pos.ts:98-190` | Confirmado |
| Clave y persistencia de carrito | `web/store/posCart.ts:98-120,182-249,275-330` | Confirmado |
| Estado incierto persistido | `web/modules/pos/hooks/usePosCartStore.ts:23-48` | Confirmado |
| Vista previa de pricing | `web/modules/pos/components/PosScreen.tsx:1354-1430` | Confirmado |
| Reintento pricing al reconectar | `PosScreen.tsx:1532-1547` | Confirmado |
| Validación de stock/cantidad local | `PosScreen.tsx:1549-1604` | Confirmado |
| Scanner wedge | `web/modules/pos/utils/pos-scanner-wedge.ts:1-150` | Confirmado |
| Matching de códigos | `web/modules/pos/utils/pos-scanner.ts:39-88` | Confirmado |
| Suscripción de scanner | `PosScreen.tsx:1617-1700`; `web/domains/peripherals/contracts.ts:637-680` | Configurado por entorno |
| Peso de producto | `PosScreen.tsx:1780-1850` | Configurado/simulado |
| Cobro y Enter | `web/modules/pos/components/payment/PaymentDialog.tsx:186-310` | Confirmado |
| Submit y clave idempotente | `PosScreen.tsx:2429-2510` | Confirmado |
| Reconciliación | `PosScreen.tsx:2011-2045` | Confirmado |
| Clasificación de errores | `PosScreen.tsx:2561-2575` | Confirmado |
| Bearer y contexto POS | `web/lib/http.ts:86-103,131-180` | Confirmado |
| Impresión posterior | `PosScreen.tsx:2520-2555`; `web/domains/peripherals/pos-sale-integration.ts:90-180` | Confirmado como post-commit |
| Pruebas unitarias existentes | `web/modules/pos/**/*.spec.ts`, `web/store/pos*.spec.ts` | Existentes; no ejecutadas |

## Limitaciones

La evidencia frontend no prueba autorización backend, aislamiento multi-tenant,
disponibilidad de caja en ambiente, conexión real al Agent, impresión física,
operación offline ni ejecución QA/producción.

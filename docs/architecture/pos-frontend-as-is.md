# Frontend operativo POS AS-IS — B4.2

## Alcance y clasificación

Esta ficha documenta `web/[tenant]/pos` y sus dependencias reales. Complementa
[B4.1](pos-transaction-as-is.md); no repite la lógica transaccional backend.

- **Implementado:** componentes, stores, clientes HTTP y estados observados en código.
- **Configurado:** URLs, flags o bridge que dependen del entorno.
- **Simulado:** controles de scanner/balanza de desarrollo presentes en UI.
- **No verificado:** ejecución QA/producción, hardware físico y compatibilidad de cada ambiente.

## Arquitectura interna

`web/app/[tenant]/pos/page.tsx` monta `PosScreen`. La pantalla coordina catálogo,
clientes, impuestos, filtros, carrito, cobro, pricing, scanner y feedback de
periféricos.

El carrito vive en Redux `posCart` y se persiste en `localStorage` por tenant,
sucursal, terminal, usuario y `posSessionId`. El contexto Redux `pos` conserva
tenant, sucursal, terminal, caja y sesión POS. `PaymentDialog` maneja la
experiencia de cobro. `pos.service.ts` llama los contratos de catálogo, pricing,
venta y reconciliación.

La pantalla es orquestador UI. No es autoridad final para precio, inventario,
permisos, caja ni aislamiento multi-tenant.

## Contexto operativo

`PosContextSelector` consulta contexto de autenticación, sucursales, terminales,
cajas y sesión actual. Puede abrir caja y luego crear sesión POS. `useRequirePosSession`
redirige a `/pos/select-context` si faltan sucursal, terminal o `posSessionId`.

El store `pos` se persiste localmente solo con contexto completo. Cambiar tenant,
sucursal o terminal limpia la sesión POS y el carrito asociado. Esto evita mezcla
local, pero no reemplaza la validación backend.

## Catálogo, carrito y precio

La pantalla carga productos por sucursal, clientes y taxes. Al agregar producto,
valida stock visible y cantidad positiva. La línea entra en `PENDING` y llama a
`POST /pricing/preview-line` con branch, producto, cantidad, canal `POS` y cliente.

La respuesta actualiza precio final, descuento, promoción, base gravable, taxes y
total de línea. Si no hay red, la línea permanece pendiente y se reintenta con los
eventos `online` o `manus:backend-restored`. Un error no recuperable marca la línea
`ERROR` y bloquea el cobro.

El frontend redondea para presentación y distribución de pagos. El backend vuelve
a calcular y valida snapshot, total y stock, como se documenta en B4.1.

## Scanner y productos pesables

Hay tres comportamientos diferenciados:

1. **Scanner wedge Web:** captura teclas rápidas, exige longitud mínima, tiempo
   máximo y Enter/CR/LF. Busca coincidencia exacta única en el catálogo cargado.
2. **Eventos periféricos configurados:** `subscribeScannerEvents` usa contratos
   de periféricos y puede recibir lectura/error del Agent según configuración.
3. **Simulación:** la UI ofrece `simulateScannerRead` cuando flags de desarrollo o
   periféricos lo permiten. No demuestra hardware físico.

Una lectura válida agrega o incrementa el producto. Código desconocido, ambiguo o
secuencia lenta genera aviso. No se encontró deduplicación temporal de una lectura
idéntica ya convertida en dos eventos válidos; la protección contra venta duplicada
queda en la clave de idempotencia del backend, no en el scanner.

Los productos `WEIGHT` pueden usar lectura de balanza configurada. El frontend
rechaza peso inestable, no positivo o Agent offline. La certificación de balanza
corresponde a B4.3.

## Cobro

`PaymentDialog` crea una línea inicial, ordena métodos activos, permite agregar o
quitar líneas y valida cliente, monto, método, referencias e institución. También
evita repetir método y exige caja para efectivo.

Enter confirma una sola acción cuando no hay envío activo. `PosScreen` vuelve a
validar, calcula cambio, adapta efectivo excedente y define `CASH` cuando el total
está cubierto; si no, usa `CREDIT`. Luego envía pagos con `cashSessionId` y
`Idempotency-Key`.

El doble envío visual se reduce con `isSubmitting`, `SUBMITTING` y el bloqueo del
store. No es una garantía distribuida: la garantía de duplicidad está en backend.

## Error y recuperación

- HTTP 4xx: la UI permite reintento como rechazo definitivo y conserva el carrito.
- Error de red, 5xx o respuesta incierta: marca `UNKNOWN`, conserva clave y bloquea
  otro envío automático.
- Reconciliación: `GET /sales/idempotency/:key`; 404, 409 y errores conservan el
  intento y muestran instrucción de verificación.
- 401: `apiClient` agrega Bearer, intenta refresh una vez y repite la solicitud.
- Precio pendiente: el carrito espera conexión o actualización; no permite cobrar.
- Impresión/cajón fallan después de venta: muestra advertencia; no revierte venta.

## Electron y periféricos

Después de recibir `SaleResponse`, la pantalla construye un ticket y llama a
`runSalePeripheralOperations`. La impresión y apertura de cajón son posteriores
al commit de venta. `AGENT_OFFLINE`, operación deshabilitada o fallo de dispositivo
producen feedback, no rollback.

El contrato frontend puede usar `window.manusTerminal` en Electron o un destino
configurado. Este documento no certifica que el navegador convencional tenga
bridge, que el Agent esté disponible, ni que exista impresión física, offline o
auto-update.

## Seguridad y límites

`apiClient` envía Bearer y, en operaciones POS, `x-pos-session-id`. El frontend
puede ocultar UI por permisos, pero los guards backend siguen siendo autoritativos.
El refresh token puede persistir en `localStorage` cuando se activa persistencia;
el riesgo ya está documentado y no se modifica en B4.2.

## Documentos relacionados

[Matriz de contratos](pos-frontend-contract-matrix-b42.md),
[estados y errores](pos-frontend-state-error-matrix-b42.md),
[evidencias](pos-frontend-evidence-matrix-b42.md),
[Electron y periféricos](electron-online-windows-implementation.md).

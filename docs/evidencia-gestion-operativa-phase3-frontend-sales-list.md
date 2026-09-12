# Evidencia — Gestión Operativa Phase 3

## Alcance

Se implementó la primera pantalla de solo lectura para `Gestión Operativa > Ventas`.
No se agregaron acciones destructivas, retransmisiones ni llamadas a FactuCore o DIAN.

## Ruta y navegación

- Ruta principal: `/{tenant}/operations/sales`.
- Ruta de módulo: `/{tenant}/operations`.
- Ruta de detalle preparada: `/{tenant}/operations/sales/:saleId`.
- La navegación usa el menú dinámico existente y agrega `OPERATIONS` / `OPERATIONS_SALES`.
- La visibilidad usa permisos de menú existentes. El backend conserva `POS READ` como permiso de lectura temporal de Phase 2.
- La ruta no usa guardas de POS ni exige una sesión de caja en el navegador.

## Componentes

- `web/modules/operational-sales/components/OperationalSalesPage.tsx`
- `web/modules/operational-sales/hooks/use-operational-sales.ts`
- `web/modules/operational-sales/services/operational-sales.service.ts`
- `web/modules/operational-sales/types.ts`

La página consume `GET /api/operations/sales`. El tenant, sucursal y turno efectivos los resuelve el backend mediante `OperationalSaleScopeService`.

## UX por rol

- `USER`: muestra “Ventas de mi turno actual”. Un `403` por falta de turno se transforma en mensaje operativo sin stack trace.
- `ADMIN`: muestra ventas de la sucursal aunque no tenga turno abierto.
- `SUPER_USER`: muestra “Ventas del tenant” y permite usar filtros que solo pueden estrechar el alcance backend.
- `SUPER_ADMIN`: respeta el contexto global existente.

No hay lógica de autorización duplicada en frontend.

## Lista

Columnas: fecha/hora, venta, cliente, estado de venta, pago, sucursal, operador, facturación electrónica y total.

Filtros soportados por Phase 2: rango de fechas, estado de venta, estado de pago, estado de facturación electrónica, número fiscal y método de pago.

Paginación server-side con límite de 25 en UI y máximo backend de 100. Ordenamiento allowlist: `createdAt`, `total`, `status`; la fecha inicia descendente.

Estados FE se presentan con etiquetas de negocio: Pendiente, Procesando, Aceptada, Rechazada, Error técnico y Cancelada. Sin documento muestra “Sin solicitar”.

## Responsive y Electron

La tabla usa scroll horizontal localizado y el layout funciona en desktop, viewport Electron y tablet razonable. Se reutiliza `apiClient` y no se modificó preload/IPC. No se envía `x-pos-session-id`, para no bloquear a `ADMIN` sin turno.

## Validación y pendientes

Se debe validar con lint/build y OpenSpec. Phase 4 queda pendiente: detalle operativo completo, navegación fiscal del cliente y acciones seguras de facturación.


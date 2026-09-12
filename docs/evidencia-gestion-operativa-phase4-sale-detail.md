# Evidencia — Gestión Operativa Phase 4

## Alcance

Se implementó el detalle operativo de venta como vista de solo lectura. Consume únicamente `GET /api/operations/sales/:saleId`; no consulta bases de datos desde el frontend y no ejecuta FactuCore, DIAN, retransmisiones ni acciones destructivas.

## Ruta y acceso

- Ruta: `/{tenant}/operations/sales/{saleId}`.
- Componente: `web/modules/operational-sales/components/OperationalSaleDetailPage.tsx`.
- Hook: `web/modules/operational-sales/hooks/use-operational-sale-detail.ts`.
- El backend sigue resolviendo `OperationalSaleScope` y valida el UUID directamente.
- `403` y `404` se muestran como mensajes genéricos, sin confirmar datos fuera del alcance.

## Secciones

La página muestra resumen, cliente, productos, pagos, contexto de sucursal/operador/turno/terminal y facturación electrónica. Los valores usan el DTO existente; no se inventan subtotal, descuentos, identificación fiscal ni timestamps no disponibles.

La FE muestra estado, número fiscal, CUFE, estado de proveedor, código de error seguro y última actualización cuando existen. No muestra XML, SOAP, credenciales ni payload crudo. Los estados tienen etiquetas de negocio para `PENDING`, `PROCESSING`, `ACCEPTED`, `REJECTED`, `TECHNICAL_ERROR` y `CANCELLED`.

## Cliente

El detalle enlaza a `/{tenant}/customers?editCustomerId={customerId}`. La pantalla existente de clientes carga el cliente dentro del tenant y abre `CustomerForm` solo si el actor ya tiene permiso de edición. No modifica el snapshot histórico de la venta.

Indicador fiscal dedicado: diferido. El DTO Phase 2 solo entrega resumen de cliente y no expone un indicador canónico de readiness; la vista no duplica reglas de facturación.

## Reimpresión y acciones

No se agregaron botones de refresh de proveedor, retry, transmit, retransmit, void, cancel, return o delete. Reprint queda para la integración segura ya existente/futura de Phase 5; esta fase solo entrega lectura operativa.

## QA manual

Validar: `USER` con turno actual, `USER` sin turno, `ADMIN` sin turno, `SUPER_USER` en sucursal autorizada, UUID fuera de alcance, venta sin FE, estados `PENDING`, `ACCEPTED`, `REJECTED`, `TECHNICAL_ERROR`, navegación de cliente, regreso a lista, desktop y viewport Electron.

## Pendientes Phase 5

Acciones operativas seguras, refresh de estado si se certifica, retry técnico con contrato explícito, auditoría de acciones, artifacts fiscales y QA físico de impresión.


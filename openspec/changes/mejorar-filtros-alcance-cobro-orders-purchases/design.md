## Context

Discovery sobre `develop` `f6a91f71` (2026-11-12):

- **Alcance:** `web/app/[tenant]/orders/page.tsx` y `web/app/[tenant]/purchases/page.tsx` muestran un banner verde "Alcance". El selector Todas / Caja actual solo aparece si existe `currentCashSession`; sin caja el banner es informativo y no permite ninguna acción. `cashScope` se envía a `GET /orders` y `GET /purchases` (`cashScope`, `cashSessionId`).
- **Filtros:** ambas páginas tienen una sección de filtros siempre visible (Buscar, fechas, sucursal, estado, filas por página, etc.) con botones Buscar y Limpiar. `orders-responsive-layout.spec.ts` verifica la grilla y las etiquetas de los filtros de pedidos.
- **Facturar pedido:** `OrderInvoiceForm.tsx` siempre muestra "Pagos nuevos" con un formulario antiguo (selector de método, monto, referencia, notas). Los pagos viajan en `POST /orders/:id/invoice`, cuyo contrato no incluye banco o billetera. La función `inventory_invoice_order` (V050) hereda automáticamente los abonos disponibles del pedido y exige, para CASH, que abonos heredados + pagos nuevos cubran el total.
- **Abonar:** la acción "Abonar" usa `DocumentPaymentForm` (modal `PaymentDialog`, métodos en tarjetas, banco o billetera obligatorio según el método), que registra un abono del pedido (`createDocumentPayment`, `SALES_ORDER`).

## Goals / Non-Goals

**Goals**
- Ganar espacio en los listados con filtros colapsables y un resumen de filtros activos.
- Mostrar "Alcance" solo cuando aporta (caja abierta) y como parte de los filtros.
- Cobrar el saldo al facturar con el mismo modal moderno de "Abonar", y no mostrar pagos cuando no hay saldo.

**Non-Goals**
- Cambios de API, base de datos o del contrato de `POST /orders/:id/invoice`.
- Cambios en la lógica de los filtros (qué filtran y cómo consultan).
- Cambios en `DocumentPaymentForm` ni en el flujo de "Abonar".

## Decisions

### D1. Panel de filtros colapsable compartido
Nuevo `web/modules/inventory/list-filters/`:
- `list-filters.ts` (puro): conteo de filtros activos frente a los valores por defecto y lectura/escritura tolerante a fallos de la preferencia mostrar/ocultar en `localStorage` (clave por módulo; si el almacenamiento no está disponible se usa el valor por defecto).
- `CollapsibleFilterPanel.tsx`: encabezado con "Filtros", conteo de activos ("Filtros (2)"), botón "Mostrar filtros" / "Ocultar filtros" con `aria-expanded` y `aria-controls`. El contenido se monta siempre y se oculta con el atributo `hidden`, para conservar el estado de los campos.
Decisión del propietario: ocultos por defecto y recordar la última elección por usuario en ese navegador.

### D2. Alcance como filtro
Se elimina el banner. Si hay caja abierta, el selector "Alcance" (Todas / Caja actual) se agrega dentro del panel de filtros y cuenta como filtro activo cuando vale "Caja actual". Sin caja abierta no se muestra y el alcance es "Todas" (comportamiento actual). Cambiar el alcance sigue recargando el listado como hoy.

### D3. Cobro al facturar con el modal moderno
- "Pagos nuevos" solo se muestra si `remainingToCover` (total a facturar menos abonos heredados) es mayor a 0.
- Se retira el formulario antiguo de pagos y la factura se envía sin pagos nuevos. Un botón "Registrar pago" abre `DocumentPaymentForm` para el pedido con `balanceDue = remainingToCover`, de modo que el monto sugerido y el máximo son el saldo de esta facturación.
- Al registrar el pago, el formulario recarga el pedido (`GET /orders/:id`): el abono aparece en "Caja y abonos heredados" y el saldo baja. El backend lo hereda al facturar.
- CASH: si queda saldo, "Facturar" muestra "Registra el pago del saldo antes de facturar (venta CASH)". CREDIT: puede facturarse con saldo pendiente.
- Si el usuario registra el pago y no factura, el pago queda como abono del pedido (mismo efecto que "Abonar").

## Risks / Trade-offs

- El cobro y la factura son dos operaciones; si la factura falla, el abono permanece en el pedido y se hereda en el siguiente intento. Es el mismo efecto que usar "Abonar" antes de facturar.
- Los filtros ocultos podrían esconder un filtro activo: se mitiga con el conteo visible en el encabezado.
- `orders-responsive-layout.spec.ts` se actualiza para el nuevo contenedor.

## Migration Plan

Solo frontend. Sin migraciones ni variables de entorno nuevas.

## Rollback

Revertir los commits del frontend.

## Open Questions

Ninguna. Decisiones del propietario (2026-11-12): abono previo con el modal moderno y herencia en la factura; filtros ocultos por defecto con resumen y preferencia recordada; Alcance dentro de los filtros solo con caja abierta.

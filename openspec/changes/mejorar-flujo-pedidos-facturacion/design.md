# Design

## Context

`getOrderById` no une clientes; el listado ya obtiene contexto de auditoría y `billingStatus`. `invoiceOrder` tipa solamente `id` aunque el resultado de venta contiene información electrónica. El hook de impresión cancela al desmontarse. El formulario de pedido captura lector dentro de `fieldScanScope`.

## Goals / Non-Goals

**Goals:** contratos aditivos, consulta agregada por pedido, impresión persistente y navegación segura con permisos.

**Non-Goals:** alterar POS, la lógica del hook, inventario, FEFO, `consumeDeliveryLots`, `inventory_create_sale_v2` o crear migraciones.

## Decisions

- Detalle: unir `customers` con LEFT JOIN por `id` y `tenant_id`; mapear nombre, documento y `terminalId` del contexto de auditoría existente. Conservar campos existentes y tolerar valores nulos; actualizar `OrderResponse` y `OrderDetailResponse`. Una búsqueda independiente por cliente agregaría llamadas y podría perder aislamiento.
- Listado: agregar `generatedSales` mediante agregación SQL correlacionada o agrupada en la misma consulta, por tenant y pedido, excluyendo `CANCELLED`; incluir `id`, `createdAt`, `total`, `status`, `electronicBillingStatus` y orden determinista. Mantener `generatedSaleId` y su selección previa. Evitar consultas por pedido y duplicación de filas al unir documentos electrónicos; determinar el registro electrónico aplicable conforme al modelo existente. Mantener la definición existente de `billingStatus` por cantidades entregadas y facturadas.
- Impresión: conservar el resultado completo de `invoiceOrder`, incluido `electronicBilling`; pasar `sale` por `onSuccess`. Montar `useSalePrintWorkflow`, modal de procesamiento y vista PDF en `orders/page.tsx`, fuera del formulario desmontado por `closeForms()`. Pasar `tenantId`, `branchId`, `posTerminalId` como `terminalId`, configuración FE y resultado de venta. Usar el aviso del hook como toast sin diálogo superpuesto; no invocar apertura de cajón. Preservar Ver ticket del pedido. Reutilizar el hook evita duplicar sus políticas existentes.
- Búsqueda: seguir `PurchaseForm` y `SearchableSelect`, conservando validación, errores, `changeBranch`, bloqueo de sucursal en edición y Terminal. Aislar entradas de búsqueda de captura HID y devolver foco al lector conforme a la política existente.
- Gestión: mostrar estado y acción solo con permiso `OPERATIONS_SALES` y ventas disponibles; una venta navega directamente, varias abren selector. `from=orders` permite retorno contextual desde `OperationalSaleDetailPage`; mantener sus permisos y funcionalidades.
- QA-01: `sale.status` `CANCELLED` o `REFUNDED` bloquea el PDF de factura original, ticket y sus impresiones porque reportería rechaza `getSaleTicket`. Deshabilitar también emisión, reintentos y recuperación incompatibles, con explicación accesible; mantener datos históricos y actualización permitida. Consultar el endpoint existente `cancel-ticket` solo para estos estados y abrir PDF únicamente cuando la respuesta sea válida; mostrar errores y carga, sin inferir disponibilidad desde estado fiscal. No modificar POS ni backend.
- Los avisos de fallos de impresión o cajón en pedidos y compras no deben afirmar que el dispositivo es MOCK. Conservar avisos de agente desconectado y el resultado de la operación.

## Risks / Trade-offs

- [Series y lectura HID] → regresión explícita de captura, foco y entregas con series.
- [FE asíncrona o impresión fallida] → respetar el flujo existente y sus avisos y fallback a ticket; no asumir aceptación.
- [Ownership y QA previo] → preservar asociaciones históricas y repetir validación de ownership y regresiones antes de implementar.

## Migration Plan

Desplegar API aditiva antes de web. Rollback de web y API a versiones anteriores; no hay migración SQL. Verificar compatibilidad de consumidores que usan `generatedSaleId`.

# Tasks

## 1. API: cliente y ventas generadas

- [x] 1.1 Agregar LEFT JOIN de cliente por id y tenant y mapear nombre, documento y terminal en detalle; verificar con pruebas de mapeo, null y aislamiento de tenant.
- [x] 1.2 Agregar `generatedSales` sin N+1 y conservar `generatedSaleId` y `billingStatus`; probar ventas múltiples, canceladas, estados FE, aislamiento y cantidad de consultas en API.

## 2. Web: datos del cliente

- [x] 2.1 Ampliar contratos de pedido y mostrar nombre/documento o `Cliente sin nombre` en Facturar, Entregar, abonos y precarga de entrega; verificar datos ausentes y sin UUID.

## 3. Web: impresión y facturación electrónica

- [x] 3.1 Conservar respuesta de venta y `electronicBilling`, pasarla en `onSuccess` y montar workflow, procesamiento y vista PDF en página; verificar cierre del formulario, contexto y ausencia de apertura de cajón.
- [x] 3.2 Probar FE `ACCEPTED`, `REJECTED`, `PENDING`, desactivada, modos `AUTOMATIC` y `ON_DEMAND`, fallback, toast y ticket original; verificar que POS y hook no cambian.

## 4. Web: búsqueda y lector

- [x] 4.1 Usar `SearchableSelect` para cliente y sucursal con datos de búsqueda disponibles; verificar validaciones, errores, `changeBranch`, edición y Terminal.
- [x] 4.2 Verificar con lector y teclado `fieldScanScope`, búsqueda, retorno de foco y regresión de captura y series.

## 5. Web: estado y gestión de ventas

- [x] 5.1 Mostrar columna Facturación y actualizar `colgroup`/`colSpan`; verificar estados y diseño responsive.
- [x] 5.2 Agregar acción con permiso `OPERATIONS_SALES`, navegación directa o selector múltiple y retorno `from=orders`; verificar cero, una y varias ventas, permisos y funcionalidad existente del detalle.

## 6. Validación integral

- [x] 6.1 Ejecutar pruebas API y build; ejecutar lint y build web, y verificar cambios protegidos con diff.
- [x] 6.2 Registrar QA manual de FE aceptada, rechazada, pendiente y desactivada, datos de cliente, buscadores con lector, ventas múltiples y regresión POS y entregas.

## 7. QA-01: documentos de venta anulada

- [x] 7.1 Bloquear acciones incompatibles para `CANCELLED` y `REFUNDED`, conservar datos históricos y verificar que no generan solicitudes; mantener ventas vigentes y navegación.
- [x] 7.2 Consultar comprobante de anulación existente con carga y manejo de PDF válido, ausencia y error; verificar mediante pruebas focalizadas y QA manual sin modificar backend o POS.

## 8. Avisos de periféricos

- [x] 8.1 Verificar que los mensajes de impresión y cajón en pedidos y compras no atribuyen fallos a MOCK y conservan el aviso de agente desconectado.

## Evidencia QA

- QA manual Windows ETAPA 2.2: PASS confirmado por el usuario, incluido QA-01 para ventas `CANCELLED` y `REFUNDED`. Confirmación recibida en esta conversación; no es evidencia de ejecución por el agente.

- QA manual Windows tarea 4.2: PASS confirmado por el usuario para lector HID y productos con series: selección, asociación, prevención de duplicados, persistencia y facturación. Evidencia proporcionada por el usuario; no ejecutada por el agente.

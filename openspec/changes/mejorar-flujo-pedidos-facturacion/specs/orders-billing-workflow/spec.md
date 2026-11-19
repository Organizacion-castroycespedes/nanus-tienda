# Spec Delta

## Purpose

El flujo de pedidos presenta datos legibles y permite gestionar e imprimir sus ventas con el contexto operativo adecuado.

## ADDED Requirements

### Requirement: Datos legibles del cliente y terminal
El detalle de un pedido SHALL devolver `customerName`, `customerDocument` y `terminalId` con aislamiento por tenant y valores nulos cuando no existan, conservando contratos previos. Facturar, Entregar, abonos y precarga de entrega SHALL mostrar nombre y documento disponibles o `Cliente sin nombre`, sin mostrar UUID como nombre.

#### Scenario: Cliente disponible
- **WHEN** se consulta un pedido con cliente del mismo tenant
- **THEN** se devuelven nombre y documento y se presentan en las operaciones del pedido

#### Scenario: Cliente ausente o de otro tenant
- **WHEN** no existe cliente del mismo tenant
- **THEN** el pedido sigue disponible y muestra `Cliente sin nombre` sin UUID

#### Scenario: Terminal del pedido
- **WHEN** existe contexto de terminal del pedido
- **THEN** el detalle devuelve su `terminalId`; si no existe devuelve null

### Requirement: Impresión de la venta facturada
Al facturar un pedido el sistema SHALL conservar el resultado electrónico y ejecutar el flujo existente de impresión con el contexto de tenant, sucursal y terminal, sin abrir cajón ni cambiar el ticket del pedido.

#### Scenario: Factura aceptada
- **WHEN** la FE está activa y resulta `ACCEPTED`
- **THEN** se procesa la factura según la configuración `AUTOMATIC` u `ON_DEMAND`

#### Scenario: Factura rechazada o pendiente
- **WHEN** la FE resulta `REJECTED` o `PENDING`
- **THEN** se informa mediante toast y se ofrece o imprime el ticket según configuración, sin diálogo adicional superpuesto

#### Scenario: FE desactivada o bajo demanda
- **WHEN** la FE está desactivada o la generación está en `ON_DEMAND`
- **THEN** se sigue el flujo de ticket configurado sin emitir automáticamente una factura

#### Scenario: Procesamiento continúa al cerrar formulario
- **WHEN** el formulario de facturación se cierra tras guardar
- **THEN** el procesamiento, su modal y la vista previa pueden continuar en la página de pedidos

#### Scenario: Ticket original
- **WHEN** el usuario elige Ver ticket del pedido
- **THEN** conserva el acceso al ticket del pedido existente

### Requirement: Búsqueda de cliente y sucursal
El formulario SHALL ofrecer búsqueda de cliente y sucursal por nombre y, donde corresponda, documento, razón social, nombre comercial, teléfono y correo; SHALL preservar validaciones, errores, cambio de sucursal, bloqueo en edición, Terminal y captura del lector.

#### Scenario: Buscar y seleccionar
- **WHEN** el usuario busca por cualquiera de los datos disponibles de cliente o por nombre de sucursal
- **THEN** puede seleccionar el resultado y se conservan las reglas del formulario

#### Scenario: Lector y edición
- **WHEN** el usuario usa un buscador y vuelve a escanear o edita un pedido
- **THEN** el foco y la captura del lector funcionan y la sucursal bloqueada no cambia

### Requirement: Ventas generadas y gestión
La lista SHALL devolver `generatedSales` para ventas no `CANCELLED` con `id`, `createdAt`, `total`, `status` y `electronicBillingStatus`, sin consultas N+1, conservando `generatedSaleId`. SHALL mostrar `UNBILLED`, `PARTIAL` o `INVOICED` y ajustar la tabla a la columna adicional.

#### Scenario: Ventas múltiples y canceladas
- **WHEN** un pedido tiene varias ventas, incluidas canceladas
- **THEN** la lista incluye todas las ventas no canceladas con sus datos y conserva `generatedSaleId` compatible

#### Scenario: Sin ventas o sin permiso
- **WHEN** no hay ventas disponibles o falta permiso `OPERATIONS_SALES`
- **THEN** no se ofrece Gestionar factura / ticket

#### Scenario: Una venta disponible
- **WHEN** el usuario autorizado selecciona Gestionar factura / ticket para una venta
- **THEN** navega directamente al detalle de esa venta con `from=orders`

#### Scenario: Varias ventas disponibles
- **WHEN** el usuario autorizado selecciona Gestionar factura / ticket para varias ventas
- **THEN** puede elegir una en un modal y navegar a su detalle con `from=orders`, con retorno a pedidos

### Requirement: Acciones de documentos para ventas anuladas
El detalle compartido SHALL impedir acciones de documentos y emisión incompatibles con ventas `CANCELLED` o `REFUNDED`, explicar la restricción y conservar la información histórica. SHALL ofrecer consulta del comprobante de anulación existente y mostrarlo solo cuando el endpoint devuelva un documento válido, informando carga y errores.

#### Scenario: Venta anulada o reembolsada
- **WHEN** una venta tiene estado `CANCELLED` o `REFUNDED`
- **THEN** ver o imprimir documentos originales, emitir, reintentar y recuperar procesamiento están deshabilitados sin solicitudes HTTP y se explica la restricción

#### Scenario: Comprobante disponible o ausente
- **WHEN** el usuario consulta el comprobante de anulación
- **THEN** se muestra solo si el endpoint entrega un PDF válido; si falla o no existe se informa el error y no se muestra un documento falso

#### Scenario: Venta vigente y navegación
- **WHEN** se consulta una venta vigente desde pedidos o POS
- **THEN** sus acciones y permisos existentes continúan y el retorno contextual se conserva

### Requirement: Avisos de periféricos precisos
Los avisos de fallo de impresión o apertura de cajón en pedidos y compras SHALL describir el fallo sin afirmar que ocurrió en un dispositivo MOCK.

#### Scenario: Fallo de periférico
- **WHEN** falla la impresión o apertura de cajón después de guardar un pedido o compra
- **THEN** el aviso identifica la operación y no atribuye el fallo a MOCK sin evidencia

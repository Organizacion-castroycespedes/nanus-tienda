## ADDED Requirements

### Requirement: Cotización de productos del catálogo

El sistema SHALL permitir crear cotizaciones por tenant y sucursal con un cliente registrado y activo obligatorio y al menos una línea. Cada línea MUST referenciar un producto activo del catálogo del tenant; el sistema MUST NOT aceptar líneas de texto libre. Cada cotización SHALL recibir un consecutivo único por tenant con formato `COT-000001`.

#### Scenario: Crear cotización válida

- **WHEN** un usuario con permiso `QUOTATIONS_CREATE` registra una cotización con cliente activo y dos productos
- **THEN** el sistema SHALL guardarla en estado `DRAFT` con el siguiente consecutivo del tenant y los totales calculados.

#### Scenario: Cotización sin cliente

- **WHEN** se intenta crear una cotización sin cliente
- **THEN** el sistema SHALL rechazarla.

#### Scenario: Línea sin producto

- **WHEN** una línea no trae `productId` o el producto es de otro tenant o está inactivo
- **THEN** el sistema SHALL rechazar la cotización completa.

#### Scenario: Cantidad decimal en producto que no la permite

- **WHEN** se cotiza 2.5 de un producto por unidad sin `allows_decimal_quantity`
- **THEN** el sistema SHALL rechazar la línea.

### Requirement: Valorización con el motor de precios

El sistema SHALL calcular en el servidor el precio, descuento por promoción e impuestos de cada línea con el motor de precios (canal `ORDER`, cliente y sucursal de la cotización) al crear, editar, renovar o duplicar. Los valores enviados por el cliente web MUST NOT usarse como precio final.

#### Scenario: Precio manipulado desde el cliente

- **WHEN** la petición trae un precio unitario distinto al del motor
- **THEN** el sistema SHALL guardar el precio calculado por el motor.

#### Scenario: Impuestos por producto

- **WHEN** se cotizan un producto con IVA 19% y otro exento
- **THEN** el sistema SHALL guardar el impuesto de cada línea y mostrar el IVA agrupado por tarifa.

### Requirement: Estados y vigencia de la cotización

El sistema SHALL manejar los estados `DRAFT`, `SENT`, `APPROVED`, `REJECTED` y `CONVERTED`. La cotización SHALL editarse solo en `DRAFT` o `SENT`. La vigencia SHALL calcularse como fecha de emisión más los días de vigencia del tenant (15 por defecto). Una cotización en `DRAFT`, `SENT` o `APPROVED` cuya vigencia terminó (fecha de America/Bogota) SHALL mostrarse como `EXPIRED`.

#### Scenario: Editar cotización aprobada

- **WHEN** se intenta editar una cotización `APPROVED`
- **THEN** el sistema SHALL rechazar el cambio.

#### Scenario: Aprobar congela precios

- **WHEN** un usuario con `QUOTATIONS_APPROVE` aprueba una cotización vigente y luego cambia el precio del producto
- **THEN** la cotización SHALL conservar los precios del momento de la aprobación.

#### Scenario: Cotización vencida

- **WHEN** la fecha actual es posterior a `valid_until` de una cotización `APPROVED`
- **THEN** el sistema SHALL mostrarla como `EXPIRED` y rechazar su aprobación o conversión.

#### Scenario: Rechazar requiere motivo

- **WHEN** se rechaza una cotización sin motivo
- **THEN** el sistema SHALL rechazar la acción.

### Requirement: Renovar y duplicar

El sistema SHALL permitir renovar una cotización vencida no convertida: recalcula precios con el motor, fija la fecha de emisión en hoy, abre una nueva vigencia y la deja en `DRAFT`. El sistema SHALL permitir duplicar cualquier cotización como una nueva en `DRAFT` con precios recalculados.

#### Scenario: Renovar cotización vencida

- **WHEN** se renueva una cotización `EXPIRED`
- **THEN** el sistema SHALL dejarla en `DRAFT`, vigente y con precios actuales.

#### Scenario: Renovar cotización vigente

- **WHEN** se intenta renovar una cotización vigente
- **THEN** el sistema SHALL rechazar la acción.

### Requirement: Vigencia configurable por tenant

El sistema SHALL permitir a usuarios con `QUOTATIONS_SETTINGS` configurar los días de vigencia por defecto del tenant entre 1 y 365. Sin configuración SHALL usar 15 días. El cambio MUST NOT alterar cotizaciones existentes.

#### Scenario: Tenant sin configuración

- **WHEN** un tenant sin configuración crea una cotización el 2026-11-19
- **THEN** la vigencia SHALL ser hasta el 2026-12-04.

### Requirement: Conversión a un único pedido

El sistema SHALL convertir una cotización `APPROVED` y vigente en un único pedido `DRAFT` con el mismo cliente, sucursal, productos, cantidades, precios e impuestos cotizados, sin recalcular precios, en una sola transacción. El pedido SHALL quedar enlazado a la cotización y la cotización SHALL pasar a `CONVERTED`. El sistema MUST NOT crear un segundo pedido desde la misma cotización. La conversión MUST NOT cambiar el comportamiento de creación, entrega, cobro ni facturación de pedidos.

#### Scenario: Convertir cotización aprobada

- **WHEN** un usuario con `QUOTATIONS_CONVERT` convierte una cotización `APPROVED` vigente
- **THEN** el sistema SHALL crear un pedido `DRAFT` con los precios cotizados, guardar `orders.quotation_id` y dejar la cotización en `CONVERTED`.

#### Scenario: Precio del producto cambió después de aprobar

- **WHEN** el precio de lista subió después de aprobar y la cotización sigue vigente
- **THEN** el pedido generado SHALL usar el precio cotizado.

#### Scenario: Doble conversión

- **WHEN** se envían dos solicitudes de conversión simultáneas de la misma cotización
- **THEN** el sistema SHALL crear un solo pedido y responder conflicto a la segunda con el pedido existente.

#### Scenario: Falla al crear el pedido

- **WHEN** la creación del pedido falla durante la conversión
- **THEN** el sistema SHALL revertir todo y la cotización SHALL seguir en `APPROVED`.

### Requirement: Documento PDF de la cotización

El sistema SHALL generar el PDF de cualquier cotización con logo, colores y datos institucionales del tenant, estado, cliente, fecha de emisión, vigencia, detalle de productos, subtotal, descuentos, IVA por tarifa, total, total en letras, condiciones, observaciones, firma del representante legal y numeración de páginas.

#### Scenario: Tenant sin logo ni colores

- **WHEN** el tenant no tiene logo ni colores configurados
- **THEN** el PDF SHALL usar las iniciales del tenant y los colores por defecto.

#### Scenario: Cotización con muchas líneas

- **WHEN** la tabla de detalle ocupa más de una página
- **THEN** el PDF SHALL repetir la cabecera de la tabla y numerar las páginas.

### Requirement: Permisos del módulo de cotizaciones

El sistema SHALL proteger el módulo con el menú `QUOTATIONS` y las acciones `QUOTATIONS_VIEW`, `QUOTATIONS_CREATE`, `QUOTATIONS_UPDATE`, `QUOTATIONS_APPROVE`, `QUOTATIONS_CONVERT` y `QUOTATIONS_SETTINGS`. Por defecto el rol `USER` SHALL tener ver, crear y editar; `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` SHALL tener todas. Toda consulta MUST filtrar por tenant y por las sucursales permitidas al actor.

#### Scenario: Usuario sin permiso de aprobar

- **WHEN** un usuario `USER` intenta aprobar una cotización
- **THEN** el sistema SHALL responder prohibido.

#### Scenario: Cotización de otro tenant

- **WHEN** se consulta una cotización de otro tenant
- **THEN** el sistema SHALL responder no encontrado.

### Requirement: Envío de la cotización por correo

El sistema SHALL permitir a usuarios con `QUOTATIONS_UPDATE` enviar una cotización vigente en `DRAFT`, `SENT` o `APPROVED` por correo, con el PDF adjunto, al correo registrado del cliente o a otro correo confirmado por el usuario, con un mensaje opcional. El PDF MUST generarse al momento y MUST NOT almacenarse en el servidor. Una cotización en `DRAFT` SHALL quedar en `SENT` solo si el correo se envía.

#### Scenario: Enviar al correo del cliente

- **WHEN** se envía una cotización en borrador sin indicar destinatario y el cliente tiene correo válido
- **THEN** el sistema SHALL enviar el correo con el PDF adjunto a ese correo y dejar la cotización en `SENT`.

#### Scenario: Enviar a otro correo

- **WHEN** el usuario indica otro correo válido
- **THEN** el sistema SHALL enviar el correo a esa dirección sin modificar los datos del cliente.

#### Scenario: Cliente sin correo y destino inválido

- **WHEN** el cliente no tiene correo y no se indica destino, o el destino no es un correo válido
- **THEN** el sistema SHALL rechazar el envío sin cambiar el estado.

#### Scenario: Falla el envío

- **WHEN** el PDF no se puede generar o el servidor de correo rechaza el mensaje
- **THEN** el sistema SHALL responder error, la cotización SHALL seguir en su estado anterior y la respuesta MUST NOT incluir credenciales.

#### Scenario: Correo no configurado

- **WHEN** falta la configuración SMTP
- **THEN** el sistema SHALL rechazar el envío indicando qué falta configurar.

#### Scenario: Cotización vencida

- **WHEN** se intenta enviar una cotización vencida
- **THEN** el sistema SHALL rechazar el envío y pedir renovarla.

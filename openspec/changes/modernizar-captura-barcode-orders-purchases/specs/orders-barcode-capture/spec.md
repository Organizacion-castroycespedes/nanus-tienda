## ADDED Requirements

### Requirement: Captura de pedidos tipo POS
El formulario de pedidos de venta SHALL ofrecer barra de escaneo, búsqueda manual y un ticket de líneas, y SHALL agregar o incrementar líneas sin duplicar el mismo producto.

#### Scenario: Primer escaneo de un producto
- **WHEN** se escanea un producto `UNIT` que no está en el ticket
- **THEN** se crea una línea con cantidad 1

#### Scenario: Escaneo repetido
- **WHEN** se escanea un producto que ya tiene línea
- **THEN** se incrementa la cantidad de esa línea y no se crea otra

#### Scenario: Control de cantidad
- **WHEN** el usuario usa los botones − / + o digita la cantidad
- **THEN** la cantidad se actualiza; una cantidad menor o igual a 0 pide confirmar la eliminación de la línea

### Requirement: Escanear no persiste
Escanear o editar líneas en un pedido SHALL NOT enviar solicitudes de escritura; el pedido SHALL persistirse solo con la acción de guardar existente, y el escaneo SHALL NOT generar movimientos de inventario, pagos ni facturación.

#### Scenario: Escaneos sin guardar
- **WHEN** el usuario escanea varios productos y no guarda
- **THEN** no se emite ninguna solicitud `POST`, `PUT` o `PATCH` a `/orders`

### Requirement: Precio calculado por el backend
El formulario SHALL mostrar el precio informativo de cada línea calculado por `POST /pricing/preview-line` con canal `ORDER`, y el backend SHALL seguir siendo la autoridad del precio al guardar.

#### Scenario: Preview disponible
- **WHEN** cambia la cantidad de una línea y el usuario tiene permiso de lectura de productos
- **THEN** la línea muestra el precio unitario, el descuento y el total calculados por el backend

#### Scenario: Sin permiso para el preview
- **WHEN** el preview responde 403
- **THEN** la línea muestra el precio de lista con la etiqueta "se recalcula al guardar"

#### Scenario: Precio persistido
- **WHEN** se guarda el pedido
- **THEN** el backend recalcula precios e impuestos y el formulario muestra los valores devueltos

### Requirement: Aviso de stock insuficiente
El formulario SHALL avisar, sin bloquear, cuando la cantidad de una línea de un producto inventariable supere el stock de la sucursal.

#### Scenario: Cantidad mayor al stock
- **WHEN** la cantidad de la línea es 5 y el stock de la sucursal es 3
- **THEN** la línea y el resumen muestran "Stock insuficiente (disponible: 3)" y el pedido se puede guardar

### Requirement: Estados y contexto del pedido
El formulario SHALL permitir capturar solo en pedidos nuevos o en estado `DRAFT`, y SHALL pedir confirmación y limpiar las líneas si se cambia la sucursal con líneas capturadas.

#### Scenario: Pedido confirmado
- **WHEN** se abre un pedido en estado distinto de `DRAFT`
- **THEN** no se muestra la barra de escaneo ni se permite editar líneas

#### Scenario: Cambio de sucursal
- **WHEN** el usuario cambia la sucursal con líneas capturadas
- **THEN** el sistema pide confirmación y, si acepta, limpia las líneas y recarga el catálogo de la nueva sucursal

### Requirement: Diseño responsive
El formulario SHALL presentar el ticket en dos columnas en escritorio y en tarjetas con total y acción principal fijos en el pie en móvil.

#### Scenario: Pantalla móvil
- **WHEN** el ancho de la ventana es menor a 768 px
- **THEN** las líneas se muestran como tarjetas y el total y "Guardar pedido" quedan visibles en el pie

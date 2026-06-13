# productos Specification

## Purpose

Definir el comportamiento esperado para productos enriquecidos en MANUS-TIENDA, manteniendo compatibilidad con el producto actual basado en `products`.

Supuesto heredado: los nombres fisicos finales de tablas o columnas nuevas se definiran en una fase de implementacion. Esta spec describe comportamiento, no migracion.

Preguntas abiertas heredadas:

- El codigo de barras puede requerir definicion de unicidad por tenant o multiples codigos por producto.
- Los estados adicionales requeridos pueden incluir `DISCONTINUED`, `BLOCKED`, `DRAFT` u otros.
- La clasificacion puede requerir definicion manual, automatica o mixta.

Riesgos heredados:

- Cambiar el contrato de `ProductResponse` sin campos opcionales puede romper POS, compras y listados.
- Usar `sku` como barcode puede mezclar responsabilidades y dificultar inventarios reales.
## Requirements
### Requirement: Producto enriquecido

El sistema SHALL permitir que un producto tenga informacion operativa adicional sin romper los campos actuales (`name`, `sku`, `price`, `cost`, `unitId`, `taxId`, `isActive`).

#### Scenario: Producto existente sin campos nuevos

- **WHEN** se consulta desde `api` o `web` un producto creado antes del cambio
- **THEN** el producto SHALL seguir siendo valido y los campos nuevos SHALL tener defaults compatibles o valores nulos permitidos.

#### Scenario: Producto nuevo con configuracion operativa

- **WHEN** un usuario autorizado crea o edita un producto con atributos operativos
- **THEN** el sistema SHALL guardar si el producto es perecedero, si requiere lote, si requiere vencimiento, su clasificacion operativa y su estado.

### Requirement: Producto perecedero/no perecedero

El sistema SHALL distinguir productos perecederos de no perecederos.

#### Scenario: Producto perecedero

- **WHEN** se recibe inventario de un producto marcado como perecedero que tambien requiere vencimiento
- **THEN** el sistema SHALL exigir vencimiento y evaluar alertas de vencimiento para ese producto.

#### Scenario: Producto no perecedero

- **WHEN** se recibe o vende inventario de un producto no perecedero
- **THEN** el sistema SHALL permitir operar sin fecha de vencimiento y SHALL NOT generar alertas de vencimiento.

### Requirement: Producto con lote obligatorio

El sistema SHALL permitir configurar que un producto requiera lote para entradas y salidas de inventario.

#### Scenario: Entrada sin lote para producto que requiere lote

- **WHEN** un usuario intenta recibir compra o ajustar inventario sin lote para un producto configurado con lote obligatorio
- **THEN** el sistema SHALL rechazar la operacion.

#### Scenario: Producto sin lote obligatorio

- **WHEN** se recibe compra o se vende un producto que no requiere lote
- **THEN** el sistema SHALL permitir el flujo actual sin lote.

### Requirement: Producto con vencimiento obligatorio

El sistema SHALL permitir configurar que un producto requiera vencimiento.

#### Scenario: Lote sin vencimiento

- **WHEN** se registra un lote sin fecha de vencimiento para un producto con vencimiento obligatorio
- **THEN** el sistema SHALL rechazar la operacion.

#### Scenario: Vencimiento solo para productos aplicables

- **WHEN** se registra inventario de un producto sin vencimiento obligatorio
- **THEN** el sistema SHALL permitir vencimiento opcional y SHALL NOT exigirlo.

### Requirement: Codigo de barras

El sistema SHALL soportar codigo de barras como identificador operativo separado de `sku` si el negocio lo aprueba.

#### Scenario: Buscar por codigo de barras

- **WHEN** el usuario busca o escanea un codigo de barras asociado a un producto
- **THEN** el sistema SHALL resolver el producto del tenant correspondiente.

### Requirement: Estado del producto

El sistema SHALL mantener estado operativo del producto sin perder compatibilidad con `is_active`.

#### Scenario: Producto inactivo

- **WHEN** se consulta catalogo POS y el producto esta inactivo
- **THEN** el producto SHALL NOT estar disponible para venta.

#### Scenario: Estado operativo adicional

- **WHEN** se usa en compras, ventas o reportes un producto con estado operativo distinto a activo o inactivo
- **THEN** las reglas SHALL respetar ese estado segun configuracion aprobada.

### Requirement: Clasificacion operativa

El sistema SHALL permitir clasificar productos para operacion y analisis.

#### Scenario: Clasificacion manual

- **WHEN** un usuario autorizado asigna clasificacion operativa al editar un producto
- **THEN** el sistema SHALL guardar la clasificacion y mostrarla en listados o reportes.

#### Scenario: Clasificacion calculada

- **WHEN** el sistema analiza ventas y movimientos para calcular rotacion
- **THEN** el sistema SHALL poder proponer una clasificacion automatica cuando la regla este aprobada.


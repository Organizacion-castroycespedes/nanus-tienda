# Spec: productos

## Proposito

Definir el comportamiento esperado para productos enriquecidos en MANUS-TIENDA, manteniendo compatibilidad con el producto actual basado en `products`.

SUPUESTO: Los nombres fisicos finales de tablas/columnas nuevas se definiran en Fase 2. Esta spec describe comportamiento, no migracion.

## Requirements

### Requirement: Producto enriquecido

El sistema SHALL permitir que un producto tenga informacion operativa adicional sin romper los campos actuales (`name`, `sku`, `price`, `cost`, `unitId`, `taxId`, `isActive`).

#### Scenario: Producto existente sin campos nuevos

- GIVEN un producto creado antes del cambio
- WHEN se consulta desde `api` o `web`
- THEN el producto SHALL seguir siendo valido
- AND los campos nuevos SHALL tener defaults compatibles o valores nulos permitidos.

#### Scenario: Producto nuevo con configuracion operativa

- GIVEN un usuario autorizado crea o edita un producto
- WHEN define atributos operativos
- THEN el sistema SHALL guardar si el producto es perecedero, si requiere lote, si requiere vencimiento, su clasificacion operativa y su estado.

### Requirement: Producto perecedero/no perecedero

El sistema SHALL distinguir productos perecederos de no perecederos.

#### Scenario: Producto perecedero

- GIVEN un producto marcado como perecedero
- WHEN se reciba inventario
- THEN el sistema SHALL exigir vencimiento si el producto tambien requiere vencimiento
- AND SHALL evaluar alertas de vencimiento para ese producto.

#### Scenario: Producto no perecedero

- GIVEN un producto no perecedero
- WHEN se reciba o venda inventario
- THEN el sistema SHALL permitir operar sin fecha de vencimiento
- AND no SHALL generar alertas de vencimiento.

### Requirement: Producto con lote obligatorio

El sistema SHALL permitir configurar que un producto requiera lote para entradas y salidas de inventario.

#### Scenario: Entrada sin lote para producto que requiere lote

- GIVEN un producto configurado con lote obligatorio
- WHEN un usuario intenta recibir compra o ajustar inventario sin lote
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Producto sin lote obligatorio

- GIVEN un producto que no requiere lote
- WHEN se recibe compra o se vende
- THEN el sistema SHALL permitir el flujo actual sin lote.

### Requirement: Producto con vencimiento obligatorio

El sistema SHALL permitir configurar que un producto requiera vencimiento.

#### Scenario: Lote sin vencimiento

- GIVEN un producto con vencimiento obligatorio
- WHEN se registra un lote sin fecha de vencimiento
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Vencimiento solo para productos aplicables

- GIVEN un producto sin vencimiento obligatorio
- WHEN se registra inventario
- THEN el sistema MAY permitir vencimiento opcional
- AND SHALL NOT exigirlo.

### Requirement: Codigo de barras

El sistema SHALL soportar codigo de barras como identificador operativo separado de `sku` si el negocio lo aprueba.

#### Scenario: Buscar por codigo de barras

- GIVEN un producto con codigo de barras
- WHEN el usuario busca o escanea ese codigo
- THEN el sistema SHALL resolver el producto del tenant correspondiente.

PREGUNTA ABIERTA: El codigo de barras debe ser unico por tenant o permitir multiples codigos por producto?

### Requirement: Estado del producto

El sistema SHALL mantener estado operativo del producto sin perder compatibilidad con `is_active`.

#### Scenario: Producto inactivo

- GIVEN un producto inactivo
- WHEN se consulta catalogo POS
- THEN el producto SHALL NOT estar disponible para venta.

#### Scenario: Estado operativo adicional

- GIVEN un producto con estado operativo distinto a activo/inactivo
- WHEN se usa en compras, ventas o reportes
- THEN las reglas SHALL respetar ese estado segun configuracion aprobada.

PREGUNTA ABIERTA: Estados adicionales requeridos: `DISCONTINUED`, `BLOCKED`, `DRAFT`, otros?

### Requirement: Clasificacion operativa

El sistema SHALL permitir clasificar productos para operacion y analisis.

#### Scenario: Clasificacion manual

- GIVEN un usuario autorizado edita un producto
- WHEN asigna clasificacion operativa
- THEN el sistema SHALL guardar la clasificacion y mostrarla en listados/reportes.

#### Scenario: Clasificacion calculada

- GIVEN el sistema analiza ventas y movimientos
- WHEN se calcule rotacion
- THEN el sistema MAY proponer una clasificacion automatica.

PREGUNTA ABIERTA: La clasificacion sera manual, automatica o mixta?

## Riesgos

RIESGO: Cambiar el contrato de `ProductResponse` sin campos opcionales puede romper POS, compras y listados.

RIESGO: Usar `sku` como barcode puede mezclar responsabilidades y dificultar inventarios reales.


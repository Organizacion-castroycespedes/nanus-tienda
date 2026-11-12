## ADDED Requirements

### Requirement: Captura con lector HID en modo teclado
Los formularios de pedidos, compras y recepción SHALL detectar lecturas de un lector de códigos de barras que opera como teclado HID mediante la velocidad de tecleo y un terminador Enter, sin integración nativa, SDK ni canal del agente de periféricos, con el mismo comportamiento en Web y Electron.

#### Scenario: Lectura del lector con foco en la barra de escaneo
- **WHEN** el lector envía un código de al menos 8 caracteres con menos de 50 ms entre teclas y termina con Enter mientras la barra de escaneo tiene el foco
- **THEN** el sistema procesa el código como un escaneo y limpia la barra

#### Scenario: Tecleo humano no se trata como escaneo
- **WHEN** el usuario digita texto en la barra a velocidad humana
- **THEN** el sistema lo trata como búsqueda manual y no como escaneo

#### Scenario: Electron
- **WHEN** se usa el mismo lector en la aplicación Electron
- **THEN** el comportamiento es idéntico al de la Web

### Requirement: Resolución explícita de códigos
El sistema SHALL resolver un código contra los códigos de barras activos y el SKU de los productos del catálogo de la sucursal y SHALL distinguir entre coincidencia única, código ambiguo, código inexistente y presentación no soportada.

#### Scenario: Coincidencia única
- **WHEN** el código normalizado coincide con un solo producto
- **THEN** el resultado es una coincidencia con ese producto

#### Scenario: Código ambiguo
- **WHEN** el código coincide con más de un producto
- **THEN** el sistema no agrega nada y muestra "Código ambiguo" con los productos candidatos para elegir manualmente

#### Scenario: Código inexistente
- **WHEN** el código no coincide con ningún producto
- **THEN** el sistema no modifica el formulario y muestra "Código no encontrado" con el código leído

#### Scenario: Código de caja o paquete
- **WHEN** el código coincide con un código de barras de tipo `PACKAGE` o `BOX`
- **THEN** el sistema no agrega nada y muestra "Presentación sin factor de conversión configurado"

#### Scenario: Código de un producto de otro tenant
- **WHEN** el código pertenece a un producto que no está en el catálogo del tenant y sucursal activos
- **THEN** el sistema lo trata como código inexistente

### Requirement: Protección de doble escaneo
El sistema SHALL ignorar una lectura del mismo código normalizado recibida dentro de los 300 ms siguientes a la lectura anterior, solo en los módulos de pedidos y compras.

#### Scenario: Doble lectura accidental
- **WHEN** el mismo código llega dos veces con 120 ms de diferencia
- **THEN** el sistema procesa una sola lectura

#### Scenario: Escaneos legítimos consecutivos
- **WHEN** el mismo código llega dos veces con 600 ms de diferencia
- **THEN** el sistema procesa ambas lecturas

### Requirement: Foco y búsqueda manual
El sistema SHALL devolver el foco a la barra de escaneo después de cada acción, salvo cuando haya un diálogo abierto, el usuario esté editando otro campo o navegue con Tab, y SHALL permitir buscar y agregar productos manualmente.

#### Scenario: Foco tras agregar
- **WHEN** un escaneo agrega o incrementa una línea
- **THEN** el foco permanece en la barra de escaneo

#### Scenario: Edición de otro campo
- **WHEN** el usuario está editando un campo de cantidad, costo o lote
- **THEN** el sistema no le quita el foco

#### Scenario: Búsqueda manual
- **WHEN** el usuario escribe parte del nombre o del código y elige un resultado
- **THEN** el producto se agrega con las mismas reglas que un escaneo

### Requirement: Lectura con foco en otro campo
Cuando el lector envía un código mientras el foco está en otro campo de texto o numérico del formulario, el sistema SHALL bloquear el Enter del lector para que no envíe el formulario, SHALL procesar el código como escaneo cuando corresponda a un producto y SHALL devolver al campo el valor que tenía antes de la lectura.

#### Scenario: Código de producto leído en el campo de lote
- **WHEN** el foco está en el campo Lote de la recepción y el lector envía el código de un producto de la compra
- **THEN** la cantidad preparada del producto aumenta, el campo Lote conserva su valor anterior y el formulario no avanza de paso

#### Scenario: Código leído en un campo de cantidad o costo
- **WHEN** el foco está en un campo de cantidad o costo y el lector envía un código
- **THEN** el código se procesa como escaneo y la cantidad o el costo no cambian

#### Scenario: Lote escaneado a propósito
- **WHEN** el foco está en el campo Lote y el lector envía un código que no corresponde a ningún producto
- **THEN** el código se conserva como lote y el formulario no se envía

### Requirement: Productos pesables
El sistema SHALL aplicar el mismo flujo de decisión que el POS según el tipo de venta del producto, con peso digitado manualmente y sin báscula.

#### Scenario: Producto por unidad
- **WHEN** se escanea un producto de tipo `UNIT`
- **THEN** se suma 1 a su línea

#### Scenario: Producto por unidad o peso
- **WHEN** se escanea un producto de tipo `BOTH` sin línea existente
- **THEN** el sistema pregunta si se agrega por unidad o por peso

#### Scenario: Producto por peso
- **WHEN** se escanea un producto de tipo `WEIGHT`
- **THEN** el sistema pide el peso, acepta valores mayores a 0 con máximo 2 decimales y lo suma a la línea

#### Scenario: No mezclar modos
- **WHEN** existe una línea del producto en modo peso y se intenta agregar por unidad
- **THEN** el sistema lo impide y explica que la línea está en modo peso

### Requirement: Retroalimentación accesible
El sistema SHALL informar cada resultado de escaneo de forma visual, sonora y mediante una región `aria-live`, y SHALL ofrecer un atajo de teclado para enfocar la barra de escaneo.

#### Scenario: Error de escaneo
- **WHEN** un escaneo termina en error
- **THEN** el mensaje se anuncia en una región `aria-live="assertive"` y suena el tono de error

#### Scenario: Atajo de teclado
- **WHEN** el usuario presiona F2
- **THEN** el foco pasa a la barra de escaneo

### Requirement: Aislamiento del POS
La captura de pedidos y compras SHALL NOT importar ni modificar código de `web/modules/pos/**`, y el comportamiento del POS SHALL permanecer sin cambios.

#### Scenario: Revisión de dependencias
- **WHEN** se revisan los archivos del change
- **THEN** ningún archivo de `web/modules/inventory/barcode/**` importa desde `web/modules/pos/**` y ningún archivo del POS aparece en el diff

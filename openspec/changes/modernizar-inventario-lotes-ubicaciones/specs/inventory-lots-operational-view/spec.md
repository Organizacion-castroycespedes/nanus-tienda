## ADDED Requirements

### Requirement: Filtros de lotes colapsables sin perder los aplicados
La vista `/inventory/lots` SHALL mostrar los filtros avanzados en un panel colapsable, oculto por defecto, y SHALL mostrar los filtros aplicados como chips visibles aunque el panel esté oculto.

#### Scenario: Primera visita
- **WHEN** el usuario abre `/inventory/lots` sin preferencia guardada
- **THEN** el panel de filtros está oculto, se ve el botón "Mostrar filtros" con `aria-expanded="false"` y la búsqueda compacta está visible

#### Scenario: Filtros aplicados con panel oculto
- **WHEN** el usuario aplica Estado "Activo" y una Ubicación y luego oculta el panel
- **THEN** el encabezado muestra "Filtros (2)" y se ven dos chips con el nombre y valor de cada filtro

#### Scenario: Quitar un chip
- **WHEN** el usuario presiona "Quitar" en el chip de Ubicación
- **THEN** ese filtro vuelve a su valor por defecto en borrador y aplicado, y la consulta se recarga

#### Scenario: Valores escritos se conservan
- **WHEN** el usuario escribe una fecha en el panel, oculta el panel y lo vuelve a mostrar
- **THEN** la fecha escrita sigue en el campo

### Requirement: Consulta solo con Buscar
La vista de lotes SHALL NOT consultar lotes ni saldos automáticamente al abrir y SHALL mantener visibles la búsqueda compacta y el botón "Buscar" aunque el panel de filtros esté oculto.

#### Scenario: Apertura de la página
- **WHEN** el usuario abre `/inventory/lots`
- **THEN** no se emiten solicitudes a `/inventory/lots` ni `/inventory/lot-balances` y el estado vacío dice "Presiona Buscar para consultar lotes y saldos."

#### Scenario: Enter en la búsqueda
- **WHEN** el usuario escribe en la búsqueda compacta y presiona Enter
- **THEN** se aplica la búsqueda y se consulta igual que con "Buscar"

### Requirement: Búsqueda compacta incluye SKU
La búsqueda de lotes SHALL coincidir, sin distinguir mayúsculas, con código de lote, nombre de producto, SKU, sucursal y ubicación.

#### Scenario: Búsqueda por SKU
- **WHEN** el usuario busca "ABC-001" y existe un lote de un producto con SKU "ABC-001"
- **THEN** la fila de ese lote aparece en el resultado

### Requirement: Filtro Producto con búsqueda
El filtro Producto de `/inventory/lots` SHALL usar el selector con búsqueda reutilizable `SearchableSelect` del design system, que SHALL filtrar el catálogo cargado por nombre o SKU sin distinguir mayúsculas ni tildes, SHALL ofrecer la opción "Todos" y SHALL operarse completamente con teclado.

#### Scenario: Buscar producto por SKU
- **WHEN** el usuario abre el filtro Producto y escribe "aguadiente003"
- **THEN** la lista muestra solo los productos cuyo nombre o SKU contienen ese texto, con el SKU visible bajo el nombre

#### Scenario: Seleccionar con teclado
- **WHEN** el usuario abre el filtro, se mueve con flecha abajo y presiona Enter
- **THEN** el producto activo queda seleccionado en el borrador, el selector se cierra, el foco vuelve al disparador y no se consulta hasta presionar "Buscar"

#### Scenario: Escape cierra sin cambiar
- **WHEN** el usuario escribe en la búsqueda del selector y presiona Escape
- **THEN** el selector se cierra sin cambiar el producto seleccionado

#### Scenario: Catálogo extenso
- **WHEN** el catálogo tiene más de 50 coincidencias
- **THEN** se muestran 50 y el texto "Mostrando 50 de N. Escribe para afinar la búsqueda."

### Requirement: Detalle como primera columna
La tabla de lotes SHALL mostrar la acción de detalle como primera columna, fija al desplazar horizontalmente, con un nombre accesible que identifique lote y producto.

#### Scenario: Orden de columnas
- **WHEN** se renderiza la tabla con resultados
- **THEN** la primera columna es "Detalle" y la segunda "Producto"

#### Scenario: Nombre accesible
- **WHEN** un lector de pantalla enfoca el botón de detalle de la fila del lote "L-10" del producto "Leche 1L"
- **THEN** anuncia "Ver detalle del lote L-10 de Leche 1L"

### Requirement: Identificación fiable del producto
La vista SHALL mostrar el nombre comercial y el SKU de cada producto del resultado y SHALL NOT mostrar el UUID del producto en la tabla operativa.

#### Scenario: Respuesta con campos de producto
- **WHEN** `/inventory/lots` devuelve `productName` "Leche 1L" y `productSku` "LCH-1"
- **THEN** la fila muestra "Leche 1L" y "LCH-1" sin solicitar el catálogo para ese producto

#### Scenario: Rol super sin sucursal aplicada
- **WHEN** un `SUPER_ADMIN` consulta lotes con Sucursal "Todas"
- **THEN** el catálogo se solicita con un `branchId` válido y las filas muestran nombre y SKU

#### Scenario: Producto ausente del catálogo
- **WHEN** la respuesta trae `productName` nulo y el `productId` no está en el catálogo cargado
- **THEN** la vista solicita `GET /products/:id` y, si responde, muestra su nombre y SKU

#### Scenario: Producto no resoluble
- **WHEN** `GET /products/:id` falla por permiso o inexistencia
- **THEN** la fila muestra "Producto no disponible" y SKU "—", y el UUID solo aparece en la trazabilidad técnica del modal

#### Scenario: Fallo parcial de búsquedas auxiliares
- **WHEN** falla la carga de productos pero sucursales y ubicaciones responden
- **THEN** los selectores de sucursal y ubicación quedan poblados y se muestra un aviso específico de productos

### Requirement: KPI con alcance único
Los indicadores de lotes SHALL calcularse sobre el mismo conjunto de filas resultante de los filtros aplicados y la búsqueda, y "Disponible vendible" SHALL sumar solo saldos de lotes `ACTIVE` con vencimiento nulo o no anterior a hoy.

#### Scenario: Búsqueda reduce indicadores
- **WHEN** el resultado tiene 10 lotes activos y una búsqueda deja 3 filas de 2 lotes activos
- **THEN** "Lotes activos" muestra 2

#### Scenario: Lote vencido con saldo
- **WHEN** un lote `ACTIVE` con fecha de vencimiento de ayer tiene 5 unidades disponibles
- **THEN** esas 5 unidades no suman en "Disponible vendible" y sí en "Disponible no vendible"

#### Scenario: Disponible no vendible como indicador
- **WHEN** el resultado tiene 5 unidades disponibles en un lote vencido y 3 en un lote bloqueado
- **THEN** la tarjeta "Disponible no vendible" muestra 8

#### Scenario: Alcance de conciliación rotulado
- **WHEN** se muestra la tarjeta de discrepancias
- **THEN** la tarjeta indica la sucursal y el producto o rango de fechas usados por la conciliación

### Requirement: Indicadores en franja única de reportería
Los indicadores de `/inventory/lots` SHALL mostrarse en una sola franja con divisiones usando el componente `ReportSummary` del design system (estándar visual de `/reporteria/compras`), con la región accesible "Indicadores del resultado", y SHALL NOT dejar celdas vacías en la franja en ningún ancho.

#### Scenario: Escritorio
- **WHEN** el usuario consulta lotes en un ancho de escritorio amplio
- **THEN** los seis indicadores aparecen en una sola fila dentro de una franja con bordes redondeados y divisiones de 1 px

#### Scenario: Móvil
- **WHEN** el usuario consulta lotes en 390×844
- **THEN** la franja muestra los indicadores en dos columnas y tres filas completas, sin scroll horizontal

#### Scenario: Desglose de no vendible
- **WHEN** existen saldos disponibles de lotes vencidos o bloqueados
- **THEN** el segmento "Disponible no vendible" muestra bajo el valor el desglose "Vencido: N · Bloqueado: N · Otros: N"

#### Scenario: Reportes existentes sin cambios
- **WHEN** se abre `/reporteria/compras` u otro reporte que usa `ReportSummary` sin las opciones nuevas
- **THEN** la franja se ve igual que antes (cuatro columnas en escritorio y rótulo accesible "Resumen del reporte")

### Requirement: Errores visibles y recuperables
La vista SHALL mostrar los fallos de conciliación y de búsquedas auxiliares con un mensaje y una acción "Reintentar", sin ocultar la tabla de lotes.

#### Scenario: Falla la conciliación
- **WHEN** `GET /inventory/lot-reconciliation/summary` responde error y la consulta de lotes responde bien
- **THEN** la tabla muestra los lotes, la tarjeta de discrepancias muestra "No disponible" y un aviso ofrece "Reintentar"

#### Scenario: Ubicación inactiva con saldo
- **WHEN** un saldo pertenece a una ubicación inactiva
- **THEN** la fila muestra "{código} - {nombre} (inactiva)" en lugar de un UUID

### Requirement: Limpiar mantiene coherencia
La acción "Limpiar" SHALL restablecer los filtros por defecto y SHALL recargar los datos si ya existía una consulta.

#### Scenario: Limpiar tras consultar
- **WHEN** el usuario consultó con un producto y presiona "Limpiar"
- **THEN** se ejecuta una nueva consulta con los filtros por defecto y la tabla refleja ese resultado

### Requirement: Lotes sin saldo diferenciados
La vista SHALL distinguir un lote sin registro de saldo de un saldo en cero.

#### Scenario: Lote sin saldo registrado
- **WHEN** un lote no tiene filas en `/inventory/lot-balances`
- **THEN** las cantidades muestran "—" y la alerta dice "Sin saldo registrado"

### Requirement: Filtros iniciales desde la URL
La vista SHALL precargar `branchId`, `locationId`, `productId` y `status` recibidos en la URL como filtros y SHALL esperar a que el usuario presione "Buscar" para consultar.

#### Scenario: Llegada desde Ubicaciones
- **WHEN** el usuario abre `/inventory/lots?branchId=B1&locationId=L1`
- **THEN** los filtros Sucursal y Ubicación quedan precargados y visibles como chips, no se consulta todavía y el estado vacío dice "Filtros precargados desde Ubicaciones. Presiona Buscar."

#### Scenario: Buscar con filtros precargados
- **WHEN** el usuario presiona "Buscar" tras llegar desde Ubicaciones
- **THEN** la consulta usa la sucursal B1 y la ubicación L1

#### Scenario: Sucursal ajena para rol no super
- **WHEN** un usuario `USER` de la sucursal B1 abre la URL con `branchId=B2`
- **THEN** la vista usa su sucursal actual B1 e ignora B2

### Requirement: Layout responsive de lotes
La vista SHALL NOT generar desplazamiento horizontal global y SHALL limitar el desplazamiento horizontal al contenedor de la tabla.

#### Scenario: Móvil
- **WHEN** se abre `/inventory/lots` en 390×844 con resultados
- **THEN** la búsqueda, el botón de filtros y la paginación caben en el ancho visible y la tabla se desplaza dentro de su panel con la columna Detalle fija

#### Scenario: Escritorio reducido
- **WHEN** se abre en 1342×802 con el panel de filtros visible
- **THEN** ningún control del panel queda cortado ni fuera del contenedor

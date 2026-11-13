## ADDED Requirements

### Requirement: Filtros colapsables en pedidos y compras
Los listados de `/orders` y `/purchases` SHALL mostrar los filtros en un panel que se puede mostrar u ocultar, oculto por defecto, y SHALL recordar la última elección del usuario en ese navegador.

#### Scenario: Primera visita
- **WHEN** el usuario abre `/orders` o `/purchases` sin una preferencia guardada
- **THEN** los filtros están ocultos y se ve el botón "Mostrar filtros"

#### Scenario: Mostrar filtros
- **WHEN** el usuario presiona "Mostrar filtros"
- **THEN** se muestran todos los filtros y los botones Buscar y Limpiar, y el botón cambia a "Ocultar filtros"

#### Scenario: Preferencia recordada
- **WHEN** el usuario deja los filtros visibles y vuelve a abrir el módulo en el mismo navegador
- **THEN** los filtros aparecen visibles

#### Scenario: Almacenamiento no disponible
- **WHEN** el navegador no permite guardar la preferencia
- **THEN** el panel funciona con el valor por defecto (oculto) sin errores

### Requirement: Resumen de filtros activos
El encabezado del panel SHALL indicar cuántos filtros aplicados difieren de sus valores por defecto.

#### Scenario: Filtros aplicados con el panel oculto
- **WHEN** hay una fecha "Desde" y una sucursal aplicadas y el panel está oculto
- **THEN** el encabezado muestra "Filtros (2)"

#### Scenario: Sin filtros
- **WHEN** todos los filtros tienen su valor por defecto
- **THEN** el encabezado muestra "Filtros" sin conteo

### Requirement: Alcance por caja solo cuando aplica
El alcance por caja (Todas / Caja actual) SHALL mostrarse únicamente cuando el usuario tiene una caja abierta, y SHALL presentarse dentro del panel de filtros; el banner de alcance SHALL NOT mostrarse.

#### Scenario: Sin caja abierta
- **WHEN** el usuario no tiene caja abierta
- **THEN** no se muestra el banner ni el selector de alcance y el listado muestra todos los registros

#### Scenario: Con caja abierta
- **WHEN** el usuario tiene caja abierta y abre los filtros
- **THEN** ve el filtro "Alcance" con las opciones Todas y Caja actual

#### Scenario: Caja actual seleccionada
- **WHEN** el usuario elige "Caja actual"
- **THEN** el listado se recarga con la operación de la caja actual y el alcance cuenta como filtro activo

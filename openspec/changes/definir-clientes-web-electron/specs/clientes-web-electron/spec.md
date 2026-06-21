## ADDED Requirements

### Requirement: Clasificacion unica de clientes Web/Electron

El sistema SHALL clasificar clientes Manus POS solo como Tipo A Web 100%, Tipo B Electron 100% o Tipo D Web + Electron para esta fase arquitectonica.

#### Scenario: Cliente administrativo sin caja fisica critica

- **WHEN** un cliente opera principalmente administracion, consulta, inventario, compras y reportes con conectividad estable
- **THEN** la clasificacion SHALL recomendar Tipo A Web 100%

#### Scenario: Cliente con terminal desktop dedicada

- **WHEN** un cliente requiere operacion POS/caja desde aplicacion desktop online
- **THEN** la clasificacion SHALL recomendar Tipo B Electron 100%

#### Scenario: Cliente con administracion y caja fisica

- **WHEN** un cliente requiere administracion separada y caja/POS en terminal fisica
- **THEN** la clasificacion SHALL recomendar Tipo D Web + Electron

### Requirement: Modelo Tipo A Web 100%

El sistema SHALL documentar Tipo A como despliegue Web cloud online, uso desde navegador moderno, sin instalacion local y sin offline.

#### Scenario: Operacion Tipo A

- **WHEN** un cliente se clasifica como Tipo A
- **THEN** el modelo SHALL indicar operacion desde navegador en Windows, Linux o macOS con conectividad estable hacia Web/API cloud

#### Scenario: Limite Tipo A

- **WHEN** el cliente requiere caja fisica con perifericos locales criticos u offline
- **THEN** el modelo SHALL indicar que Tipo A no es la opcion recomendada

### Requirement: Modelo Tipo B Electron 100%

El sistema SHALL documentar Tipo B como aplicacion desktop Electron online con API cloud, configuracion por tenant/sucursal/terminal y sin offline en esta fase.

#### Scenario: Electron como contenedor online

- **WHEN** un cliente se clasifica como Tipo B
- **THEN** el modelo SHALL indicar que Electron actua como contenedor desktop online y que la API cloud mantiene la logica de negocio

#### Scenario: Electron sin conectividad

- **WHEN** la terminal Electron no tiene conectividad
- **THEN** el modelo SHALL indicar que la fase actual no permite ventas offline ni sync queue

### Requirement: Modelo Tipo D Web + Electron

El sistema SHALL documentar Tipo D como uso combinado con Web para administracion y Electron para POS/caja online.

#### Scenario: Administracion y caja separadas

- **WHEN** un cliente opera backoffice y caja fisica
- **THEN** el modelo SHALL asignar administracion a Web y POS/caja a Electron

#### Scenario: Sincronizacion operativa

- **WHEN** Web y Electron operan en Tipo D
- **THEN** la sincronizacion operativa SHALL ocurrir mediante API cloud mientras exista conectividad

### Requirement: Soporte Electron por sistema operativo

El sistema SHALL documentar soporte conceptual Electron para Windows, Linux y macOS con prioridad Windows, luego Linux, luego macOS.

#### Scenario: Prioridad Windows

- **WHEN** se planifica la primera fase Electron POS
- **THEN** Windows SHALL ser la prioridad inicial con artefactos posibles `.exe` o `.msi`

#### Scenario: Soporte Linux posterior

- **WHEN** se planifica soporte Linux
- **THEN** el modelo SHALL tratar AppImage, `.deb` y `.rpm` como artefactos posibles y validar drivers por distribucion

#### Scenario: Soporte macOS posterior

- **WHEN** se planifica soporte macOS
- **THEN** el modelo SHALL considerar `.dmg` o `.pkg`, firma, notarizacion y validacion de perifericos caso por caso

### Requirement: Offline fuera de alcance actual

El sistema SHALL documentar offline como consideracion futura, sin implementarlo ni disenar una solucion definitiva en esta fase.

#### Scenario: Solicitud de offline

- **WHEN** se evalua operacion offline para Electron
- **THEN** la fase actual SHALL registrar riesgos y componentes futuros sin crear service worker, sync engine, almacenamiento local nuevo ni cambios de persistencia

### Requirement: Fase documental sin cambios runtime

El sistema SHALL limitar este change a documentacion y OpenSpec sin modificar codigo, SQL, frontend, backend, permisos, rutas, contratos API, dependencias ni logica de negocio.

#### Scenario: Ejecucion del change

- **WHEN** se entrega la fase `definir-clientes-web-electron`
- **THEN** los cambios SHALL estar limitados a documentos de arquitectura y artefactos OpenSpec

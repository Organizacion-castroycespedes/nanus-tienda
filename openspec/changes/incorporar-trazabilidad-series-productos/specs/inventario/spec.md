## ADDED Requirements

### Requirement: Movimientos de productos con serie
Para productos con serie, el sistema SHALL exigir que toda entrada de inventario registre una serie nueva por unidad y que toda salida identifique las series que salen, y SHALL rechazar los flujos que aún no soportan series.

#### Scenario: Ajuste de entrada
- **WHEN** se ajusta +2 un producto con serie indicando 2 series nuevas
- **THEN** quedan 2 series `AVAILABLE` enlazadas al ajuste y el kardex sube 2

#### Scenario: Ajuste de salida
- **WHEN** se ajusta −1 un producto con serie indicando una serie disponible, devuelta o bloqueada
- **THEN** la serie queda `WRITTEN_OFF` enlazada al ajuste y el kardex baja 1

#### Scenario: Ajuste sin series
- **WHEN** se ajusta un producto con serie sin indicar series
- **THEN** el ajuste se rechaza sin efectos

#### Scenario: Importación de stock
- **WHEN** un archivo de importación de stock incluye un producto con serie
- **THEN** la prevalidación marca la fila como no soportada y no se confirma la carga de esa fila

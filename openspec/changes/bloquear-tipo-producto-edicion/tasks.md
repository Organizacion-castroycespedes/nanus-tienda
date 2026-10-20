# Tasks

## OpenSpec y governance

- [x] 1.1 Documentar alcance, criterios de creacion y edicion inmutable.
- [x] 1.2 Asociar rutas frontend y artifacts de OpenSpec en el manifest de governance.

## Frontend

- [x] 2.1 Mantener seleccion de `isInventoryable` en creacion y bloquearla en edicion para ambos valores persistidos.
- [x] 2.2 Mostrar explicacion de bloqueo y ocultar `inventoryabilityChangeReason` en edicion.
- [x] 2.3 Omitir `isInventoryable` y `inventoryabilityChangeReason` del payload de update sin alterar otros campos.

## Pruebas y validacion

- [x] 3.1 Cubrir controles de creacion y edicion para inventariable y servicio.
- [x] 3.2 Cubrir preservacion del valor persistido, payload sin cambio de tipo, ocultacion condicional del motivo y edicion de otros atributos.
- [x] 3.3 Ejecutar pruebas focalizadas, lint, typecheck/build, OpenSpec estricto, governance y `git diff --check`.

## 1. Discovery and contract

- [x] 1.1 Confirmar el generador PDF, ruta frontend y flujo Browser/Windows actual.
- [x] 1.2 Medir papel nominal, contenido actual y ancho seguro para `THERMAL_80MM`.
- [x] 1.3 Crear requisito verificable y diseño de layout sin cambio de negocio.

## 2. Thermal layout

- [x] 2.1 Declarar constantes de geometría `THERMAL_80MM` y usar márgenes seguros.
- [x] 2.2 Reservar columnas para importes y evitar overflow del borde derecho.
- [x] 2.3 Permitir wrapping seguro de identificadores y nombres largos.

## 3. Tests and evidence

- [x] 3.1 Agregar pruebas de geometría, importes, textos largos y totales.
- [x] 3.2 Actualizar evidencia QA de XP-80 con hallazgo, causa y protocolo físico pendiente.

## 4. Validation

- [x] 4.1 Ejecutar tests y build de `backend-reporteria`.
- [x] 4.2 Ejecutar pruebas/lint/build web aplicables.
- [x] 4.3 Ejecutar validación OpenSpec strict y `git diff --check`.
- [x] 4.4 Documentar el siguiente gap POS -> Peripheral Agent sin implementarlo.

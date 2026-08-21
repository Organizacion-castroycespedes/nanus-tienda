## Why

El ticket POS de Reportería se genera como PDF de 80 mm nominales y se imprime
desde el visor PDF del navegador usando el driver Windows. La impresión física
en la cola USB `XP-80` funciona, pero el borde derecho corta importes y deja
poco margen para las columnas. El documento debe reservar ancho seguro para
una impresora térmica de 80 mm sin alterar los datos ni reglas de venta.

## What Changes

- Formalizar una geometría de layout `THERMAL_80MM` para PDF: papel nominal,
  área imprimible común y ancho seguro de contenido.
- Ajustar el template de ticket POS para usar columnas con presupuesto fijo,
  valores monetarios alineados dentro del ancho seguro y texto largo que se
  puede envolver.
- Agregar pruebas puras del layout y evidencia QA para la impresión Browser /
  Windows / XP-80.

## Non-Goals

- No modificar ventas, cálculos, impuestos, pagos, descuentos, inventario ni
  datos de caja.
- No integrar impresión automática, ESC/POS para este ticket, cajón, scanner,
  balanza, persistencia o migraciones.
- No usar escala manual de Chrome como solución.

## Impact

- Afecta `backend-reporteria` y documentación QA.
- El flujo conserva `Manus -> PDF -> Browser -> Windows spooler -> impresora`.
- `backend-perifericos` no participa en este cambio.

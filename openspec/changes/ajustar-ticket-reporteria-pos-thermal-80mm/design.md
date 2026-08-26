## Context

`/reporteria/pos` abre un PDF generado por `backend-reporteria`. El botón
`Imprimir` llama `iframe.contentWindow.print()`. Chrome muestra su diálogo y
envía el PDF al spooler/driver Windows. No se usa el Peripheral Agent en este
camino.

El PDF actual mide 226 pt (79.7 mm) y tiene márgenes horizontales de 12 pt
(4.2 mm). El contenido queda en 202 pt (71.3 mm). Una térmica de 80 mm suele
aceptar papel nominal de 80 mm, pero su área de puntos imprimibles suele ser
cercana a 72 mm y puede ser menor según driver/configuración. Por eso 71.3 mm
no deja reserva práctica frente al borde físico.

## Decision

El layout tendrá constantes explícitas para `THERMAL_80MM`:

- papel: 80 mm nominales (226.77 pt);
- área imprimible de referencia: 72 mm;
- ancho seguro de contenido: 68 mm;
- margen físico seguro: 6 mm por lado.

El documento mantiene tamaño de papel de 80 mm y reduce el contenido a 68 mm.
Así no depende de reducir escala manual en Chrome y deja tolerancia para el
driver de la impresora.

Las tablas de items, pagos y totales usarán ancho de columna explícito. El
valor monetario recibirá una columna reservada, alineada a la derecha. Los
textos de identificadores y tokens largos recibirán oportunidades de corte
visual sin borrar datos. Los nombres de producto podrán envolver dentro de la
columna de item.

## Error and compatibility behavior

Este cambio solo afecta presentación. El dataset, importes, totales, pagos,
impuestos y datos de venta permanecen intactos. Browser print conserva su
diálogo de impresora y selección manual de cola.

## QA boundary

Las pruebas automatizadas verifican la geometría y estructura de documento.
El resultado físico depende de la cola/driver Windows y requiere QA manual
posterior con `XP-80`, papel 80 mm y escala estándar/100 %.

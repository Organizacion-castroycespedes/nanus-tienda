## Decision

Crear `RowActionsMenu` en `web/components/design-system`. El componente solo
resuelve presentaciÃ³n y comportamiento visual: botÃ³n compacto, portal en
`document.body`, posicionamiento fijo con lÃ­mites del viewport, apertura hacia
arriba cuando no hay espacio, reposicionamiento durante scroll/resize, cierre
externo/Escape y navegaciÃ³n de teclado.

El componente admite `RowActionItem` para ProductRowActions y `children` para
que reporterÃ­a conserve exactamente sus botones existentes. No conoce IDs,
permisos, estados de negocio, servicios ni acciones de dominio.

`ProductRowActions` conserva su ediciÃ³n directa y todas sus condiciones. Las
tablas de reporterÃ­a solo mueven sus botones existentes al menÃº visual. El
ancho de la columna se reduce a una celda compacta; el menÃº vive fuera del
scroll de la tabla para evitar clipping.

`OperationalSalesPage` conserva `useOperationalSales`, actualizaciÃ³n automÃ¡tica
de filtros, ordenamiento, paginaciÃ³n, mensajes y navegaciÃ³n. Solo cambia el
shell visual y la agrupaciÃ³n compacta de filtros.

## Accessibility and responsive behavior

El trigger conserva `aria-haspopup`, `aria-expanded` y `aria-label`. El portal
usa `role=menu`; sus items son botones nativos. Escape devuelve foco al trigger,
y flechas/Home/End navegan items del menÃº de acciones tipado. La posiciÃ³n usa
un mÃ­nimo de 8px frente a los bordes del viewport y funciona para 800x600,
1024x768 y 1280x720.

## Risks

La validaciÃ³n visual completa requiere navegador y datos reales. La selecciÃ³n
de fecha en `operations/sales` conserva la actualizaciÃ³n automÃ¡tica existente;
QA debe confirmar que el hook no cambia su frecuencia observable de consulta.


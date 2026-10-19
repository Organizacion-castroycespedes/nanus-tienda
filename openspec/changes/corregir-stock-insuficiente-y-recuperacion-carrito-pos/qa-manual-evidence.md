# Evidencia QA manual — rechazo de stock y recuperación POS

Fecha reportada: `2026-10-18`

## Alcance y fuente

Esta nota consolida únicamente evidencia QA manual suministrada por el
usuario. No se repitieron ventas, consultas SQL, builds, llamadas a FactuCore
ni transmisiones DIAN durante esta actualización.

Las capturas, observaciones y consultas mencionadas no están adjuntas en el
repositorio. No se inventan logs, trazas técnicas, respuestas SOAP ni
aceptaciones técnicas independientes de DIAN.

## Ocho escenarios reportados PASS

| # | Escenario manual | Resultado reportado | Límite de evidencia |
| --- | --- | --- | --- |
| 1 | Venta con stock suficiente. | PASS manual reportado. | No se adjunta log técnico. |
| 2 | Cantidad solicitada superior a la disponibilidad actual. | PASS manual reportado: rechazo definitivo de stock. | No se repite la operación en esta sesión. |
| 3 | Producto con stock cero. | PASS manual reportado: rechazo definitivo y recuperación del carrito. | No se adjunta trazabilidad técnica. |
| 4 | Rechazo por stock FEFO insuficiente. | PASS manual reportado. | La evidencia no certifica una nueva ejecución concurrente. |
| 5 | Recuperación a `DRAFT` después de rechazo definitivo. | PASS manual reportado: edición, eliminación o cancelación segura. | No se afirma una nueva venta o pago persistido. |
| 6 | Dos terminales. | PASS manual reportado: aislamiento entre operaciones. | No se adjuntan IDs de terminal ni logs. |
| 7 | Tablet. | PASS manual reportado: flujo usable en pantalla tablet. | No se adjunta captura en el repositorio. |
| 8 | Protección `UNKNOWN`. | PASS manual reportado: resultado ambiguo conserva protección y no desbloquea edición insegura. | No se adjunta log de timeout o red. |

Estos ocho estados son evidencia funcional manual reportada. No equivalen a
la cobertura automatizada de las tareas `3.1`, `3.2` y `3.3`, que permanecen
abiertas.

## Evidencia histórica relacionada

- Ventas `b9405104` y `34acc511`, ambas de `133` unidades, quedaron
  `Devuelta` después del flujo de anulación DIAN código `2`.
- La reversión loteada reportada devolvió `100` unidades a `LOTE-001` y `33`
  a `LEGACY-001`, conservando los lotes usados por los movimientos `OUT`.
- Los snapshots Kardex reportados fueron `1330` y `0133`, con acumulado
  consistente.
- La reconciliación local `LEGACY-001` terminó con `RECONCILIATION_PASS` y no
  creó un movimiento Kardex adicional.
- La aceptación DIAN queda como resultado funcional observado por el usuario
  mediante estado `Devuelta`; no se declara respuesta SOAP independiente.

## Estado de certificación

- Ocho escenarios manuales: `PASS manual reportado`.
- Pruebas automatizadas P1: `PENDING` en tareas `3.1`, `3.2` y `3.3`.
- Aceptación técnica DIAN/SOAP: `PENDING`.
- QA global: no se declara `PASS` por esta nota.

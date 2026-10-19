# Evidencia QA manual — anulación DIAN código 2 y Kardex

Fecha reportada: `2026-10-18`

## Alcance y fuente

Esta nota consolida únicamente evidencia QA manual suministrada por el usuario.
No se repitieron pruebas, consultas SQL, builds, llamadas a FactuCore ni
transmisiones a DIAN durante esta actualización.

Las capturas y consultas mencionadas fueron observadas manualmente, pero no se
adjuntan como archivos del repositorio. No se inventa una respuesta SOAP ni una
aceptación técnica independiente de DIAN.

## Evidencia observada

| Caso | Evidencia | Estado |
| --- | --- | --- |
| Venta y anulación electrónica total | Venta `b9405104`, `133` unidades, factura `SETP990000037`, terminó en estado `Devuelta` después del flujo de anulación DIAN código `2`. | PASS manual reportado |
| Segunda venta y anulación electrónica total | Venta `34acc511`, `133` unidades, factura `SETP990000038`, terminó en estado `Devuelta` después del flujo de anulación DIAN código `2`. | PASS manual reportado |
| Venta final | Venta `d25f777a`, `133` unidades, factura `SETP990000039`, quedó en estado `Confirmada`. | PASS manual reportado |
| Venta inicial y devolución parcial observada | Venta y anulación de `6` unidades usando `LOTE-001`. | PASS manual reportado |
| Selector DIAN | El motivo visualizado y seleccionado fue el código `2`. | PASS visual reportado |
| Reconciliación histórica | `LEGACY-001` fue reconciliado localmente con resultado `RECONCILIATION_PASS`; no se creó un movimiento nuevo de Kardex. | PASS reportado |

El estado `Devuelta` demuestra la aceptación funcional observada por el usuario
en el flujo integrado. No demuestra por sí solo una respuesta SOAP DIAN
capturada, un código técnico de proveedor o una nueva aceptación en esta
sesión.

## Kardex y lotes

- Los movimientos `IN`/`OUT` observados fueron de `133` unidades.
- Los snapshots observados fueron `1330` y `0133`; el acumulado se reportó
  consistente.
- En ventas `OUT`, `stock_movement_lots` mostró `100` unidades de `LOTE-001`
  y `33` de `LEGACY-001`.
- En las anulaciones `IN`, los mismos lotes recibieron `100` y `33` unidades,
  respectivamente.
- Después de la última venta, el saldo actual reportado de ambos lotes fue
  `0`.

Estos puntos son evidencia manual reportada. No se afirma una nueva lectura de
base de datos en esta actualización.

## Matriz de aceptación

| Área | Resultado | Nota |
| --- | --- | --- |
| Modal con solo código DIAN `2` | PASS manual | Verificación visual reportada. |
| Payload y DTO/backend para código `2` | PASS previo de implementación | No se reejecutó en esta actualización. |
| Estado funcional `Devuelta` tras anulación electrónica | PASS manual reportado | Sin respuesta SOAP independiente. |
| Reversión loteada `100 + 33` | PASS manual reportado | Mismos lotes en `OUT` e `IN`. |
| Snapshots y acumulado Kardex | PASS manual reportado | Valores observados: `1330` y `0133`. |
| Reconciliación `LEGACY-001` sin movimiento adicional | PASS reportado | Resultado previo `RECONCILIATION_PASS`. |
| FEFO bajo concurrencia | PENDING | No certificado manualmente en esta evidencia. |
| Doble anulación | PENDING | No quedó demostrada con evidencia suficiente. |
| Caja y pagos | PENDING | No certificados manualmente. |
| Pruebas frontend automatizadas | PENDING | No existe infraestructura automatizada disponible para este alcance. |
| Aceptación técnica DIAN/SOAP | PENDING | No se capturó respuesta técnica independiente. |
| Recuperación integral | UNKNOWN | Se observó operativa posteriormente en cuentas nuevas, pero no fue certificada de forma integral. |
| UX con stock insuficiente | FAIL — P1 | Error `P0001` y cuenta bloqueada. Defecto pendiente de corrección. |

## Relación con tareas OpenSpec

Las tareas `3.2` y `3.3` de `tasks.md` permanecen abiertas. Esta evidencia no
las cierra: faltan pruebas completas de snapshots y reversión, y pruebas
automatizadas frontend del selector y payload.

La HU `inmutabilizar-configuracion-estructural-productos` no se modifica ni se
mezcla con esta evidencia. Su reconciliación histórica conserva su propio
runbook y estado.

## Límites de certificación

- Esto no es un PASS global de QA.
- No autoriza PR, commit, despliegue ni nueva transmisión electrónica.
- La aceptación DIAN queda como evidencia funcional manual reportada, no como
  certificación técnica independiente.
- El defecto P1 de stock insuficiente sigue abierto.

## Boundary

Este change cubre únicamente identidades y checksums históricos hasta V095.
La evidencia puede demostrar presencia, ausencia o drift; no demuestra por sí
sola que un SQL no fue ejecutado.

## Classification

Cada hallazgo conserva su fuente y se clasifica como uno de:

- `REPOSITORY_ONLY`
- `HISTORY_ONLY`
- `CHECKSUM_DRIFT`
- `CHECKSUM_UNVERIFIABLE`
- `DUPLICATE_NUMERIC_VERSION`
- `PREEXISTING_HISTORICAL_BASELINE`

La clasificación es declarativa. No es una orden de ejecución.

## Safety

El reconciliador debe fallar cerrado si la identidad no es comparable. No debe
usar un hallazgo histórico como candidato post-cutover. No puede ejecutar SQL,
renombrar archivos, renumerar versiones, reescribir checksums, insertar history
ni borrar registros.

V096 y toda versión mayor que V095 quedan fuera de esta excepción histórica.

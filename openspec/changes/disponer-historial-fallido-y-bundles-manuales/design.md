## Boundary

Este change trata únicamente registros históricos `success=false`, checksums
manuales/bundle y afirmaciones de ejecución manual dentro del baseline V095.

## Disposition

Los hallazgos conservan origen, versión y estado disponible. Un registro
fallido se clasifica como `HISTORICAL_REVIEW_REQUIRED`. Una procedencia manual o
bundle se mantiene como `EXECUTED_LEGACY` o no verificable, nunca como
`HISTORY_CERTIFIED` sin evidencia contractual suficiente.

## Safety

La disposición solo produce metadata declarativa. No repara history, no cambia
checksums, no ejecuta SQL y no autoriza una migración futura. V096 manual
adoption sigue siendo una excepción estrecha y separada; no se generaliza.

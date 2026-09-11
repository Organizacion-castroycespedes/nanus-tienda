# Evidencia: feature de facturación electrónica hacia develop

## Resultado

- La rama de facturación conserva el E2E único de `SETP990000007`: DIAN, FactuCore y Manus quedaron en `ACCEPTED`.
- El vínculo de proveedor se recuperó por `external_reference`; no hubo creación, XML, firma, transmisión ni polling adicional.
- El campo `cufe` existe en Manus y el adaptador lo conserva cuando el proveedor lo entrega. El endpoint de estado usado en la prueba no lo expuso; el contrato y OpenSpec actual no lo exigen para `ACCEPTED`. Clasificación: `NOT_IN_CURRENT_CONTRACT_NON_BLOCKING`.

## Regresiones verificadas

- Recovery de proveedor aceptado sin `create`: PASS.
- Persistencia normal de identidad del proveedor: PASS.
- Normalización `CASH` a `paymentMeansCode=10` y `paymentMeansId=1`: PASS.
- Propagación de ubicación fiscal: PASS.
- Outbox/inbox e idempotencia: PASS.
- Reconciliación `ACCEPTED` y `REJECTED`: PASS.
- Billing: `143/143` PASS.
- API: `565` PASS, `1` skipped, `0` fail.
- API, Billing y Web build: PASS.

## Estado de promoción

- Se requiere commit de los cambios intencionales y merge de la feature hacia `develop`.
- No se promueve a `0.0.1` ni a `main` en esta etapa.
- El fallo restante de OpenSpec all (`corregir-handoff-agent-local-perifericos-electron`) es deuda preexistente de `origin/develop`, no de facturación electrónica.
- Workers globales de Manus y FactuCore permanecen deshabilitados.


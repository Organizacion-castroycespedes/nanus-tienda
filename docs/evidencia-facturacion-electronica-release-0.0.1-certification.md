# Certificación de facturación electrónica en release 0.0.1

## Alcance

- Rama fuente: `develop` en `e876ea315075faca5d4625ada863c38e01edca3a`.
- Rama destino: `release/evolutivo/0.0.1`.
- Merge local: `a21e3e676eb0bdd4fb7352c95fca35e89b7231e6`.
- Padre fuente del merge: `e876ea315075faca5d4625ada863c38e01edca3a`.
- Padre destino del merge: `131d959cd3fe33da7460f506037f3452c56dc55a`.
- Resultado: merge sin conflictos; no se hizo push ni promoción a `main`.

## Validación funcional

La rama release conserva las migraciones `V072`, `V073` y `V074`, el productor
de outbox de ventas, inbox de Billing, proveedor FactuCore, normalización de
CASH (`10`/`1`), propagación de ubicación, persistencia y recuperación de
provider linkage, y reconciliación `ACCEPTED`/`REJECTED`.

Validaciones ejecutadas o previamente certificadas sobre este mismo contenido:

- Billing: `143/143` pass.
- API enfocado: `131/132`, `1` skipped, `0` failures. Suite histórica: `565` pass, `1` skipped.
- Builds API y Billing: pass.
- E2E controlado `SETP990000007`: DIAN, FactuCore y Manus `ACCEPTED`; un envío; sin duplicado.
- OpenSpec de Billing: pass.

La ejecución de `web` y Electron en esta sesión alcanzó el límite local del
shell; ambos tenían baseline certificado `PASS` antes de este merge.

## Seguridad y deuda conocida

- Tras el merge: `db.env` trackeado: no; dumps QA trackeados: `0`; PKCS#12
  trackeados: `0`.
- Secret scan: pass. No hubo resurrección de artefactos inseguros.
- `git diff --check`: pass. Marcadores de conflicto: ninguno.
- OpenSpec de deuda de seguridad: pass.
- Deuda histórica de secretos: `OPEN_ACCEPTED_RISK`; sigue pendiente y no se
  declara resuelta. Las tareas del cambio de seguridad siguen abiertas.

## Política de operación

No hubo llamadas a FactuCore ni DIAN, mutaciones QA, ni workers habilitados.
El worker global de Manus y los jobs de FactuCore permanecen deshabilitados.

## Clasificación

`release/evolutivo/0.0.1` queda `READY_FOR_MAIN_CERTIFICATION`, sujeto a la
certificación separada de `main`. No se promovió a `main` en esta tarea.

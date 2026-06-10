# Evidencia QA - Bootstrap Failure Analysis MVP-00.4.7A

## Objetivo

Analizar el fallo del bootstrap real de `manus_tienda_qa` y corregir la clasificacion del SQL problematico sin reintentar bootstrap ni ejecutar migraciones.

## Estado actual de `manus_tienda_qa`

Segun evidencia operativa recibida:

- DB `manus_tienda_qa` creada.
- Usuario `manus_qa_user` creado.
- `public.migrations_history` contiene 50 migraciones aplicadas.
- Bootstrap detenido durante migraciones incrementales.
- No se reintento bootstrap en esta fase.
- No se borro `manus_tienda_qa`.
- No se toco `manus_tienda`.

## Archivo fallido

```text
scripts/database/migrations/20260505_reporting_pos_fixtures.sql
```

Error reportado:

```text
QA reporting fixtures require user 781912fe-5a32-483f-b99a-a931f9700913
```

## Causa raiz

`migrate_prd.sh` lee automaticamente todos los archivos `*.sql` dentro de `scripts/database/migrations/` y los ejecuta en orden alfabetico.

El archivo `20260505_reporting_pos_fixtures.sql` estaba ubicado dentro de `migrations/`, por lo que fue tratado como migracion obligatoria. Sin embargo, su contenido muestra dependencias fijas de QA/demo:

- tenant fijo `00000000-0000-0000-0000-000000000001`;
- usuario fijo `781912fe-5a32-483f-b99a-a931f9700913`;
- caja/sesion fija `44ad07a9-38b2-49b4-8361-7da53d17c0a7`;
- datos de ventas, pagos y sesiones de prueba.

Conclusion: el archivo es fixture/demo de reportería POS, no migracion estructural obligatoria para bootstrap limpio.

## Fix aplicado

### `scripts/database/migrate_prd.sh`

- Se agrego flag seguro:
  - `RUN_OPTIONAL_QA_FIXTURES="${RUN_OPTIONAL_QA_FIXTURES:-${APPLY_OPTIONAL_FIXTURES:-NO}}"`
- Default: `NO`.
- Se valida que el flag solo acepte `YES` o `NO`.
- Se agrego lista de fixtures opcionales:
  - `20260505_reporting_pos_fixtures.sql`
- El loop de migraciones incrementales ahora salta ese fixture por defecto.
- Si `RUN_OPTIONAL_QA_FIXTURES=YES`, el fixture puede ejecutarse explicitamente despues de las migraciones obligatorias.

### `scripts/database/bootstrap-manus-tienda-qa.sh`

- Exporta `RUN_OPTIONAL_QA_FIXTURES` hacia `migrate_prd.sh`.
- Registra en log que los SQL fixtures opcionales solo corren con `RUN_OPTIONAL_QA_FIXTURES=YES`.
- Mantiene `APPLY_OPTIONAL_FIXTURES=NO` como default seguro por env.

### `scripts/database/bootstrap-manus-tienda-qa.manifest.md`

- `20260505_reporting_pos_fixtures.sql` fue reclasificado como fixture opcional.
- Ya no figura en migraciones obligatorias default.
- Se documenta que requiere datos fijos de QA/demo y no debe correr por defecto.
- `V053` y `V054` siguen en el flujo obligatorio.

### `docs/runbook-exec-bootstrap-manus-tienda-qa.md`

- Se documento que `APPLY_OPTIONAL_FIXTURES=NO` debe conservarse para bootstrap limpio.
- Se aclaro que `20260505_reporting_pos_fixtures.sql` es opcional.
- Se aclaro que el bootstrap debe saltar fixtures QA opcionales por defecto.

## Riesgos

- La DB `manus_tienda_qa` quedo parcialmente creada con 50 migraciones aplicadas.
- Reintentar bootstrap debe hacerse solo con aprobacion humana y luego de revisar estado parcial.
- El fixture opcional puede fallar si no existen usuario/caja/sesion demo.
- Si se desea ejecutar fixtures demo, debe hacerse en fase separada con `APPLY_OPTIONAL_FIXTURES=YES`.
- No ejecutar contra `manus_tienda`.

## Proximos pasos

1. Revisar estado parcial de `manus_tienda_qa` antes de reintentar.
2. Reintentar bootstrap solo en fase autorizada.
3. Mantener `APPLY_OPTIONAL_FIXTURES=NO`.
4. Validar que el runner salta `migrations/20260505_reporting_pos_fixtures.sql`.
5. Completar smoke SQL y actualizar evidencia de bootstrap.

## Resultado

`QA_BOOTSTRAP_FIXTURE_CLASSIFIED`

## Validaciones

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS. Resultado: `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS con warnings CRLF informativos.
- `git status --short`: PASS informativo. Cambios en docs, OpenSpec y scripts de DB; sin env real versionado.

## Restricciones cumplidas

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se borro `manus_tienda_qa`.
- No se toco `manus_tienda`.
- No se toco PRD.
- No se desplego.
- No se reinicio servidor.

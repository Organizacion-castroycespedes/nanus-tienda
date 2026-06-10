# Evidencia QA - Forward Runner Excludes Rollback - MVP-00.4.7D

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.4.7D - Excluir rollback scripts del forward migration runner`

Resultado: `QA_FORWARD_RUNNER_EXCLUDES_ROLLBACK`

## Objetivo

Corregir el runner forward para que nunca ejecute rollback scripts durante el bootstrap de `manus_tienda_qa`.

## Contexto

El bloqueo anterior en `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql` ocurrio porque `document_type_code` no existia al momento de ejecutar V052.

El analisis de `MVP-00.4.7C` confirmo:

- `document_type_code` si es creado por `20260603_electronic_invoicing_customers_phase_1.sql`.
- `document_type_code` si es creado por `20260604_electronic_invoicing_suppliers_phase_1.sql`.
- Los rollback scripts `*_rollback.sql` pueden eliminar esas columnas.
- `migrate_prd.sh` listaba todos los `*.sql` bajo `scripts/database/migrations/` sin excluir rollbacks.

## Alcance

Archivos modificados:

- `scripts/database/migrate_prd.sh`
- `scripts/database/bootstrap-manus-tienda-qa.sh`
- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- `docs/runbook-exec-bootstrap-manus-tienda-qa.md`
- `openspec/changes/mvp-web-hardening/tasks.md`

Archivo creado:

- `docs/evidencia-qa-forward-runner-excludes-rollback-mvp-00-4-7D.md`

## Cambio aplicado

En `scripts/database/migrate_prd.sh` se agrego una funcion:

```bash
is_rollback_migration() {
  local version="$1"

  if [[ "$version" == *_rollback.sql || "$version" == *rollback*.sql ]]; then
    return 0
  fi

  return 1
}
```

El loop de migraciones incrementales ahora omite rollback SQL antes de validar/aplicar:

```bash
if is_rollback_migration "$sql_file"; then
  echo "[prd] Skipping rollback SQL in forward migration runner: migrations/${sql_file}"
  continue
fi
```

Esto cubre:

- `*_rollback.sql`
- `*rollback*.sql`

## Rollback SQL identificados

Archivos que ahora deben quedar fuera del forward bootstrap:

- `20260601_inventory_products_lots_phase_1_rollback.sql`
- `20260602_inventory_create_sale_v2_rollback.sql`
- `20260603_electronic_invoicing_customers_phase_1_rollback.sql`
- `20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`
- `20260605_pricing_promotions_phase_1_rollback.sql`
- `20260607_orders_pricing_snapshot_phase_6_7_1_rollback.sql`

## Comportamiento esperado

Cuando el runner encuentre un rollback SQL en `scripts/database/migrations/`, debe imprimir:

```text
[prd] Skipping rollback SQL in forward migration runner: migrations/<archivo>
```

El archivo no debe aplicarse y no debe registrarse como version forward en `public.migrations_history`.

## Documentacion actualizada

Manifest:

- Indica que `*_rollback.sql` y `*rollback*.sql` se omiten siempre del flujo forward.
- Lista los rollback SQL conocidos.
- Mantiene rollback SQL solo para ejecucion manual documentada.

Runbook:

- Declara que rollback SQL no forma parte del forward bootstrap.
- Agrega validacion posterior para confirmar que `migrations_history` no contiene versiones con `rollback`.

Wrapper QA:

- `bootstrap-manus-tienda-qa.sh` registra que los rollback SQL son excluidos por `migrate_prd.sh`.

## Riesgos

- La base parcial `manus_tienda_qa` puede tener rollbacks ya aplicados y registrados si el intento anterior llego a ejecutarlos.
- Un nuevo intento sobre la misma DB parcial podria no restaurar columnas si las migraciones forward ya estan marcadas como aplicadas.
- Recomendacion tecnica: no reintentar bootstrap sobre DB parcial sin decision explicita de limpiar/recrear `manus_tienda_qa` o aplicar repair SQL controlado.
- Rollback SQL siguen siendo destructivos por naturaleza. Deben ejecutarse solo manualmente, con backup y aprobacion humana.

## Validaciones

Ejecutadas desde `D:/Profe/manus-tienda`:

- `bash -n scripts/database/migrate_prd.sh`: PASS
- `bash -n scripts/database/bootstrap-manus-tienda-qa.sh`: PASS
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS con warnings LF/CRLF en archivos modificados
- `git status --short`: PASS revisado

Estado Git al cierre:

```text
 M docs/runbook-exec-bootstrap-manus-tienda-qa.md
 M openspec/changes/mvp-web-hardening/tasks.md
 M scripts/database/bootstrap-manus-tienda-qa.manifest.md
 M scripts/database/bootstrap-manus-tienda-qa.sh
 M scripts/database/migrate_prd.sh
?? docs/evidencia-qa-forward-runner-excludes-rollback-mvp-00-4-7D.md
?? docs/evidencia-qa-migration-dependency-analysis-v052.md
```

## Restricciones cumplidas

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco AWS.
- No se toco `manus_tienda`.
- No se modifico `manus_tienda_qa`.
- No se borraron datos.
- No se desplego.
- No se reinicio servidor.

## Siguiente paso recomendado

Preparar fase de reintento controlado solo despues de decidir que hacer con la DB parcial:

- recrear `manus_tienda_qa` limpia, o
- aplicar repair SQL aprobado.

No reintentar bootstrap todavia.

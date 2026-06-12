# Evidencia QA functional seeds + FE mock implementation MVP-01.2B

Fecha: 2026-06-10 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Fuentes:

- `docs/evidencia-qa-operativo-integral-mvp-01-2.md`
- `docs/evidencia-qa-functional-seed-config-remediation-plan-mvp-01-2A.md`

Resultado: `QA_FUNCTIONAL_SEED_CONFIG_IMPLEMENTED`

## Restricciones

- No se ejecutaron migraciones.
- No se ejecuto bootstrap.
- No se toco AWS.
- No se modifico DB real.
- No se hizo deploy.
- No se reinicio PM2.
- No se modifico `.env` real.
- No se agregaron secretos.
- No se tocaron datos productivos.

## Implementacion

| Tarea | Estado | Evidencia |
| --- | --- | --- |
| Normalizar consumidor final | PASS | Creado `scripts/database/migrations/V058__qa_required_catalog_seed.sql`. |
| Resolver mismatch `is_default` vs `is_final_consumer` | PASS | `V058` agrega/usa `is_default`, escoge un candidato por tenant, desmarca duplicados y garantiza un final consumer activo. |
| No romper `ux_customers_tenant_default` | PASS | `V058` desmarca defaults no elegidos antes de marcar el default elegido y recrea el indice unique si falta. |
| Seeds minimos `units` | PASS | `migrate_prd.sh` ahora incluye `products/2026_04_25_seed_inventory_units.sql`; `V058` refuerza `UND`, `KG`, `LT`, `CJ`. |
| Seeds minimos `taxes` | PASS | `migrate_prd.sh` ahora incluye `products/2026_04_25_seed_inventory_taxes.sql`; `V058` refuerza `IVA 19%` y `Exento`. |
| Payment methods | PASS | Ya estaban en `sale/004_sale_payment_methods.sql`; no hay catalogo adicional que sembrar. |
| Consumidor final | PASS | `011_prd_default_customer.sql` queda como legacy idempotente; `V058` normaliza FE/default antes. |
| Fixtures QA opcionales | PASS | Creado `scripts/database/migrations/20260611_mvp_01_2b_functional_qa_fixtures.sql`. |
| Gate fixtures | PASS | `migrate_prd.sh` ejecuta el fixture solo con `RUN_OPTIONAL_QA_FIXTURES=YES` o `APPLY_OPTIONAL_FIXTURES=YES`. |
| FE lookup MOCK docs | PASS | Actualizados `api/.env.example` y `backend-facturacion-electronica/.env.example`. |
| Manifest/runbook | PASS | Actualizados `scripts/database/bootstrap-manus-tienda-qa.manifest.md`, `docs/runbook-exec-bootstrap-manus-tienda-qa.md` y `docs/runbook-bootstrap-manus-tienda-qa.md`. |

## Archivos creados

- `scripts/database/migrations/V058__qa_required_catalog_seed.sql`
- `scripts/database/migrations/20260611_mvp_01_2b_functional_qa_fixtures.sql`
- `docs/evidencia-qa-functional-seeds-fe-mock-implementation-mvp-01-2B.md`

## Archivos actualizados

- `scripts/database/migrate_prd.sh`
- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- `docs/runbook-exec-bootstrap-manus-tienda-qa.md`
- `docs/runbook-bootstrap-manus-tienda-qa.md`
- `api/.env.example`
- `backend-facturacion-electronica/.env.example`
- `openspec/changes/mvp-web-hardening/tasks.md`

## V058 required catalog seed

`V058__qa_required_catalog_seed.sql` hace:

1. Valida tablas requeridas: `tenants`, `customers`, `units`, `taxes`.
2. Asegura columna legacy `customers.is_default`.
3. Asegura `units.is_active` y `taxes.is_active`.
4. Normaliza consumidor final por tenant:
   - prefiere un `is_final_consumer=true` activo;
   - si no existe, usa `is_default=true`;
   - si no existe, usa nombre `Consumidor Final`;
   - si no existe ninguno, inserta uno.
5. Desmarca candidatos duplicados para no romper `ux_customers_tenant_default`.
6. Garantiza `is_final_consumer=true`, `is_default=true`, `is_active=true` y `fiscal_status='NOT_REQUIRED'`.
7. Asegura unidades base activas: `UND`, `KG`, `LT`, `CJ`.
8. Asegura impuestos base activos: `IVA 19%`, `Exento`.

## Fixture QA opcional

`20260611_mvp_01_2b_functional_qa_fixtures.sql` crea o actualiza solo datos prefijados QA:

- proveedor FE demo: `QA Proveedor FE Base`;
- cliente FE demo: `QA Cliente FE Base`;
- producto demo: `QA-BASE-LOT-001`;
- barcode principal: `7700000000011`;
- barcode alterno: `QA-ALT-BASE-LOT-001`;
- ubicacion: `QA-DEMO`;
- lote demo: `QA-LOT-MVP-01-2B-001`;
- balance con `quantity_on_hand=25.00`;
- movimiento de inventario `ADJUSTMENT` para trazabilidad.

El fixture queda registrado en `functional_qa_fixture_migration_files` y no corre por defecto. Se ejecuta con `RUN_OPTIONAL_QA_FIXTURES=YES` o `APPLY_OPTIONAL_FIXTURES=YES`, separado del fixture reporting legacy.

## FE lookup MOCK

Variables documentadas para QA:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

No se configuro modo `real`. No se agregaron certificados, WSDL, tokens ni passwords.

## Validacion pendiente de ejecucion QA

Cuando haya ventana aprobada y se ejecute bootstrap/migracion en QA, validar:

```text
GET /api/electronic-invoicing/customers/default -> HTTP 200
POST /api/electronic-invoicing/customers/default/ensure -> idempotente
GET /api/units -> UND/KG/LT/CJ activos
GET /api/taxes -> IVA 19% y Exento activos
POST lookup clientes/proveedores -> provider=MOCK_LOCAL
GET /api/inventory/lot-balances -> lote QA visible si fixtures opcionales corrieron
```

## Validaciones locales

| Comando | Estado | Resultado |
| --- | --- | --- |
| `bash -n scripts/database/migrate_prd.sh` | PASS | Sintaxis bash OK. |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS | `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS | Exit 0; solo warnings LF/CRLF en working copy. |
| `git status --short` | PASS | Cambios versionados y archivos nuevos listados; sin comandos destructivos. |

## Decision

Las correcciones versionadas e idempotentes quedaron implementadas en repo. La aplicacion real queda pendiente de ventana aprobada.

Estado emitido:

```text
QA_FUNCTIONAL_SEED_CONFIG_IMPLEMENTED
```

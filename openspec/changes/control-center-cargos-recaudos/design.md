## Context

La fase 1 dejó contratos con versiones inmutables, ítems por frecuencia (`MONTHLY`, `ANNUAL`, `ONE_TIME`), un snapshot del impuesto, el día de corte (`billing_anchor_day`), el fin de la prueba (`trial_ends_on`) y la política de prorrateo (`DAILY`/`NONE`).

Lo que se reutiliza:

- montos en centavos con `BigInt` (`shared/money.ts`) y fechas con ajuste a fin de mes (`shared/dates.ts`);
- auditoría transaccional;
- pool dedicado;
- el patrón de workers con `setTimeout` y bandera de habilitación;
- el patrón de almacenamiento local seguro de imágenes de producto (`LocalImageStorageService`).

## Goals / Non-Goals

**Goals**

- Ningún cargo duplicado aunque el proceso se ejecute varias veces o en paralelo.
- Saldos siempre consistentes: un cargo nunca recibe más de su total y un recaudo nunca aplica más de su valor (garantizado por la base de datos).
- Cálculo trazable: cada línea del cargo apunta al ítem del contrato y, si hubo prorrateo, guarda el factor de días.

**Non-Goals**

- Notificaciones (fase 3).
- Factura electrónica de MANUS.
- Pasarela de pagos.
- Suspensión de tenants.
- Devolución de dinero.

## Decisions

### D1. Entidades (esquema `control_center`)

| Tabla | Columnas clave | Integridad |
|---|---|---|
| `charges` | `id`, `charge_number` (`MCC-COB-AAAA-NNNNNN`), `contract_id`, `account_id`, `tenant_id`, `contract_version_id`, `kind` (`PERIOD`/`PRORATION`/`ONE_TIME`), `billing_frequency` (`MONTHLY`/`ANNUAL`/`ONE_TIME`), `period_start`, `period_end`, `issue_date`, `due_date`, `currency`, `tax_name_snapshot`, `tax_rate_snapshot`, `prices_include_tax`, `subtotal`, `base_amount`, `tax_amount`, `total_amount`, `paid_amount`, `status` (`OPEN`/`PARTIALLY_PAID`/`PAID`/`VOID`), `generation_source` (`WORKER`/`MANUAL`/`AMENDMENT`), `void_reason`, `voided_at`, `voided_by` y campos de auditoría | Índice único parcial `(contract_id, kind, billing_frequency, period_start) WHERE status <> 'VOID'` para `PERIOD`/`ONE_TIME` y `(contract_version_id, billing_frequency)` para `PRORATION`; solo cambian `paid_amount`, `status`, anulación y `updated_*`; `0 <= paid_amount <= total_amount` |
| `charge_lines` | `id`, `charge_id`, `contract_item_id`, `item_type`, `description`, `quantity`, `unit_amount`, `discount_amount`, `proration_factor numeric(9,6) null`, `line_total` | Inmutable (sin `UPDATE`/`DELETE`) |
| `receipts` | `id`, `receipt_number` (`MCC-REC-AAAA-NNNNNN`), `account_id`, `received_on`, `amount > 0`, `source` (`PAYMENT`/`PRORATION_CREDIT`), `payment_method_id`, `payment_method_code`, `payment_method_name`, `financial_institution_id`, `financial_institution_name` (referencia y snapshot del catálogo de MANUS; nulos en créditos de prorrateo), `reference`, `notes`, `attachment_storage_key`, `attachment_mime`, `attachment_size`, `allocated_amount`, `attachment_original_name`, `contract_id` y `source_contract_version_id` (solo créditos de prorrateo; uno vigente por versión), `status` (`CONFIRMED`/`VOID`), `void_reason`, `voided_at`, `voided_by` y campos de auditoría | Índice único parcial `(account_id, payment_method_code, reference) WHERE reference IS NOT NULL AND status = 'CONFIRMED'` contra pagos duplicados; `CHECK` que exige medio de pago cuando `source = 'PAYMENT'` |
| `receipt_allocations` | `id`, `receipt_id`, `charge_id`, `amount > 0`, `created_at`, `created_by`, `reversed_at`, `reversed_by`, `reversal_reason` | Solo se permite registrar el reverso una vez (trigger). Un trigger de restricción diferido verifica que la suma activa por recaudo no supere su valor y que la suma activa por cargo no supere su total |
| `billing_runs` | `id`, `trigger_source` (`WORKER`/`MANUAL`), `actor_user_id`, `contract_id` (manual), `run_date`, `lead_days`, `status` (`RUNNING`/`COMPLETED`/`FAILED`), `started_at`, `finished_at`, `contracts_scanned`, `charges_created`, `errors jsonb` | Bitácora del proceso |

`paid_amount` y `status` del cargo se recalculan en la misma transacción de cada aplicación, reverso o anulación.

### D2. Cálculo de períodos

- **Inicio de facturación:** `trial_ends_on` si existe; si no, `effective_from` de la versión inicial. Durante la prueba no se generan cargos.
- **Inicio de cada período:** `inicio + k × (1 mes | 12 meses)`, calculado siempre desde el inicio original con `addMonthsClamped`, para que el ajuste a fin de mes no se acumule. El fin del período es el inicio del siguiente menos un día.
- **Versión aplicable:** la versión vigente en la fecha de inicio del período.
- **Cargos por frecuencia:** los ítems `MONTHLY` generan cargos mensuales y los `ANNUAL` cargos anuales en cada aniversario. Los `ONE_TIME` generan un único cargo `ONE_TIME` en el primer período de la versión que los introduce.
- **Vencimiento:** cobro anticipado, `due_date = inicio del período`. El cargo se emite cuando `inicio − hoy ≤ CONTROL_CENTER_BILLING_LEAD_DAYS` (5 por defecto, en hora de Bogotá).
- **Totales:** se calculan con el snapshot de impuesto de la versión, con la misma fórmula de `summarizeItems`. Un cargo con total 0 (por ejemplo, solo la certificación bonificada) se registra como `PAID`.
- **Contratos terminados:** no se generan períodos que empiecen después de `end_date`. No hay devolución por terminación anticipada.

### D3. Generación idempotente

`BillingService.generateForContract(contractId, source, today)` hace lo siguiente en una transacción:

1. Toma `pg_advisory_xact_lock(hashtext(contract_id))`.
2. Calcula los períodos pendientes dentro de la ventana.
3. Inserta cada cargo con sus líneas. Si el índice único parcial reporta conflicto, el período ya existe y se omite.
4. Audita `CHARGE_GENERATED`.

El worker recorre los contratos `ACTIVE` por lotes, registra la ejecución en `billing_runs`, usa el actor de sistema `00000000-0000-0000-0000-000000000000` con el tenant plataforma y solo corre si el Control Center y `CONTROL_CENTER_BILLING_WORKER_ENABLED` están activos. El botón manual llama al mismo método con `source = MANUAL` y el usuario real.

### D4. Prorrateo diario por enmienda

Se ejecuta dentro de la transacción de `ContractsService.amend`, con el bloqueo de facturación del contrato, después de crear la nueva versión con fecha `E`, y solo si su política es `DAILY`. Para cada frecuencia (mensual y anual) cuyo período contiene `E` con `inicio < E ≤ fin` (y `E` posterior al inicio de facturación):

- `valor_viejo` y `valor_nuevo` son los netos de la frecuencia según cada versión, agrupados por tipo de ítem.
- `diferencia = valor_nuevo − valor_viejo`.
- `factor = (fin − E + 1) / (fin − inicio + 1)`.
- `monto = redondeo_a_pesos(diferencia × factor)`.
- Si `monto > 0`, se crea un cargo `PRORATION` (período `E..fin`, vence en `E`) con una línea por tipo de ítem que cambió y su factor.
- Los montos negativos de todas las frecuencias se suman en un solo recaudo `PRORATION_CREDIT`, enlazado a la nueva versión, que se aplica automáticamente a los cargos abiertos del mismo contrato empezando por el vencimiento más antiguo. Lo que sobra queda como saldo a favor.
- Antes de crear la versión, los cargos `PERIOD` y `ONE_TIME` futuros (inicio ≥ E) ya generados se anulan con el motivo "Reemplazado por enmienda vN". Si alguno tiene pagos aplicados, la enmienda se rechaza con 409 hasta que se reviertan.
- El período que contiene `E` se cobrará con la versión anterior (la vigente en su inicio); por eso el prorrateo no depende de que ese cargo ya exista.

Con política `NONE` no hay prorrateo y el cambio rige desde el siguiente período. Al terminar un contrato se anulan, con la misma regla de pagos, los cargos cuyo período inicia después de la fecha de terminación.

### D5. Recaudos y comprobantes

- **Medios de pago:** se reutiliza el catálogo existente de MANUS en lugar de una lista propia. Los medios son los de `public.payment_methods` del tenant plataforma (activos y con `tipo` distinto de `CREDIT`), administrados desde el módulo de finanzas actual. Las entidades financieras salen de `public.financial_institutions` (activas, del tenant plataforma o globales con `tenant_id` nulo). El recaudo guarda el id y un snapshot del código y el nombre, sin llave foránea entre esquemas, para que el historial no cambie si el catálogo se edita. Si el medio tiene `requires_reference` se exige referencia; si tiene `requires_financial_institution` se exige entidad. `GET control-center/payment-methods` entrega el catálogo con sus entidades.

- **Registro:** `POST receipts` (con `Idempotency-Key`) recibe cuenta, fecha, valor, medio, referencia, notas, comprobante opcional y `allocations` opcionales (`[{ chargeId, amount }]`) o `autoAllocate: true` (cargos abiertos de la cuenta, del más antiguo al más nuevo). Lo que no se aplica queda como saldo a favor.
- **Comprobante:** PDF, JPEG, PNG o WebP de hasta `CONTROL_CENTER_RECEIPT_MAX_SIZE_MB` (5 por defecto). Se valida tipo MIME, extensión y firma del archivo. Se guarda en `LOCAL_UPLOADS_DIR/control-center/receipts/` con nombre aleatorio y solo se descarga desde un endpoint protegido del Control Center; no hay URL pública.
- **Aplicación posterior:** `POST receipts/:id/allocations`.
- **Reverso de una aplicación:** `POST allocations/:id/reverse`, con motivo.
- **Anulación de un recaudo:** `POST receipts/:id/void`, con motivo. Revierte todas sus aplicaciones.
- **Concurrencia:** se bloquean el recaudo y los cargos con `FOR UPDATE`, en orden por `id`, y el trigger diferido es la última garantía.

### D6. Cargos y cartera

- **Cargos:** `GET charges` (filtros por estado, cuenta, tenant, contrato, rango de vencimiento y vencidos), `GET charges/:id` (líneas y aplicaciones), `POST contracts/:id/charges/generate` (botón manual) y `POST charges/:id/void` (con motivo y sin aplicaciones activas).
- **Cartera:** `GET receivables/summary` da totales globales y por cuenta: saldo abierto, vencido por tramos según los días de mora desde `due_date` (hora de Bogotá), saldo a favor y próximos vencimientos (15 días).

- **Anulación de contrato registrado por error:** `POST contracts/:id/void` con motivo. Solo para contratos `ACTIVE` (los borradores se cancelan) y solo si ningún cargo tiene pagos aplicados (409 en caso contrario). Con el bloqueo de facturación del contrato, anula todos sus cargos y sus créditos de prorrateo sin aplicar y deja el contrato en `CANCELLED`, lo que libera el índice de contrato abierto por tenant. Los pagos de la cuenta no cambian y quedan como saldo a favor. Se diferencia de terminar, que conserva los cargos ya causados.

Acciones críticas nuevas (motivo obligatorio): `CHARGE_VOIDED`, `RECEIPT_VOIDED`, `ALLOCATION_REVERSED` y `CONTRACT_VOIDED`.

### D7. Privilegios

- El rol dedicado tiene `SELECT`/`INSERT`/`UPDATE` en `charges`, `receipts`, `receipt_allocations` y `billing_runs`.
- En `charge_lines` solo tiene `SELECT`/`INSERT`.
- No tiene `DELETE` en ninguna tabla.
- Las secuencias de numeración tienen `USAGE`.
- `SELECT` por columnas en `public.payment_methods` (`id`, `tenant_id`, `codigo`, `nombre`, `tipo`, `requires_reference`, `requires_financial_institution`, `active`, `sort_order`, `icon`, `color`) y `public.financial_institutions` (`id`, `tenant_id`, `codigo`, `nombre`, `nombre_corto`, `tipo`, `active`, `sort_order`). Sin escritura.

### D8. Web

- Pestaña **Cartera**: indicadores (`ReportSummary`), tabla de cuentas con tramos y listas de cargos y recaudos con filtros.
- Modal "Registrar pago" con aplicación manual o automática y adjunto.
- En la ficha del contrato: sección de cargos y botón "Generar cargos".
- Anulaciones y reversos con `ReasonDialog`.

## Risks / Trade-offs

- **Cambios de precio entre la generación anticipada y el inicio del período.** No afectan, porque el cargo usa la versión del contrato, no el catálogo.
- **Worker en varias instancias.** Lo cubren el bloqueo por contrato y el índice único.
- **Enmiendas con pagos ya aplicados a cargos futuros.** Se rechazan con 409 para evitar inconsistencias. Exige revertir primero.
- **El tenant plataforma no tiene medios de pago activos.** El registro de pagos responde 422 y el formulario indica configurarlos en Finanzas.
- **Almacenamiento local de comprobantes en servidores con varias réplicas.** La configuración actual tiene una sola instancia (pm2 fork). Migrar a almacenamiento de objetos queda fuera de alcance.

## Migration Plan

V113 es aditiva. El worker se despliega apagado. Se activa en QA y, después de validar, en PRD.

**Rollback:** desactivar el worker y aplicar el rollback protegido, que falla si hay datos.

## Open Questions

Ninguna. Confirmado: ventana de anticipación de 5 días y medios de pago tomados del catálogo `payment_methods` del tenant plataforma.

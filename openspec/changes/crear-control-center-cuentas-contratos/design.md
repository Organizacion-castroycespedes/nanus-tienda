## Context

El esquema `control_center` y el rol dedicado ya existen gracias al change previo. Los tenants viven en `public.tenants`. Las terminales cobrables son `public.pos_terminals` con `active = true`. Las sucursales son `public.tenant_branches` con `estado = 'ACTIVE'`. El dinero se maneja en COP. Las fechas comerciales usan `America/Bogota`.

## Goals / Non-Goals

**Goals**

- Modelo comercial versionado que soporte la propuesta actual y sus cambios futuros sin migraciones de datos.
- Integridad garantizada por la BD: un vínculo activo por tenant, un contrato vigente por tenant, versiones inmutables.
- Dejar listos los datos que la Fase 2 necesita para cobrar: frecuencia, ancla, prueba, prorrateo, IVA e ítems.

**Non-Goals**

- Calcular cargos o prorrateos (Fase 2). Esta fase solo almacena la política.
- Bloquear la creación de terminales.
- Emitir facturas.

## Decisions

### D1. Entidades (esquema `control_center`)

| Tabla | Columnas clave | Integridad |
|---|---|---|
| `commercial_accounts` | `id uuid`, `legal_name`, `tax_id_type` (`NIT`/`CC`/`CE`/`PASAPORTE`), `tax_id`, `dv`, `billing_email`, `contact_name`, `contact_phone_e164`, `whatsapp_opt_in bool`, `whatsapp_opt_in_at`, `address`, `municipio_id` (opcional), `status` (`ACTIVE`/`INACTIVE`), `notes`, auditoría de creación y actualización | `UNIQUE (tax_id_type, tax_id)` |
| `account_tenants` | `id`, `account_id` → `commercial_accounts`, `tenant_id` → `public.tenants(id) ON DELETE RESTRICT`, `status` (`ACTIVE`/`ENDED`), `linked_at`, `ended_at`, `end_reason` | índice único parcial `(tenant_id) WHERE status='ACTIVE'` |
| `plans` | `id`, `code` único, `name`, `description`, `status` (`ACTIVE`/`RETIRED`) | — |
| `plan_price_versions` | `id`, `plan_id`, `version_no`, `valid_from date`, `valid_to date null`, `currency` (`COP`), `tax_id` (impuesto del tenant plataforma en `public.taxes`, validado en servicio), `prices_include_tax bool` (por defecto el `is_included` del impuesto), `included_pos_terminals int`, `initial_term_months int`, `default_trial_months int` (por defecto 1) | `UNIQUE (plan_id, version_no)`; una sola versión abierta por plan (índice único parcial `valid_to IS NULL`). Sin solapes por construcción: cada versión nueva debe iniciar después de la anterior y cierra la abierta (`valid_to = valid_from_nueva − 1 día`), con lock del plan. No se usa `btree_gist` |
| `plan_price_components` | `id`, `price_version_id`, `component` (`BASE_INITIAL_TERM`, `BASE_RENEWAL`, `EXTRA_POS_TERMINAL`, `CERTIFICATION`), `billing_frequency` (`MONTHLY`/`ANNUAL`), `amount numeric(18,2) >= 0` | `UNIQUE (price_version_id, component, billing_frequency)` |
| `contracts` | `id`, `contract_number` legible (`MCC-AAAA-NNNNN`), `account_id`, `tenant_id`, `plan_id`, `status` (`DRAFT`/`ACTIVE`/`ENDED`/`CANCELLED`), `start_date`, `end_date null`, `current_version_id` | el tenant debe tener vínculo `ACTIVE` con la cuenta (validado en servicio y re-chequeado con `SELECT ... FOR UPDATE`); índice único parcial `(tenant_id) WHERE status IN ('DRAFT','ACTIVE')` |
| `contract_versions` | `id`, `contract_id`, `version_no`, `effective_from`, `effective_to null`, `term_phase` (`INITIAL`/`RENEWAL`), `billing_frequency`, `billing_anchor_day 1..31` (día de `start_date`), `trial_ends_on null`, `proration_policy` (`NONE`/`DAILY`), `tax_id`, `tax_name_snapshot`, `tax_rate_snapshot numeric(8,4)`, `prices_include_tax`, `currency`, `included_pos_terminals` (snapshot de la versión de precio), `source_price_version_id`, `reason`, `created_by` | `UNIQUE (contract_id, version_no)`; una sola versión abierta por contrato; inmutable salvo cierre único de `effective_to` (trigger) |
| `contract_items` | `id`, `contract_version_id`, `item_type` (`BASE`/`EXTRA_POS_TERMINAL`/`CERTIFICATION`/`CUSTOM`), `description`, `quantity numeric(12,2) > 0`, `unit_amount numeric(18,2) >= 0`, `billing_frequency` (`MONTHLY`/`ANNUAL`/`ONE_TIME`), `discount_amount >= 0`, `metadata jsonb` | inmutable (trigger); `CUSTOM` cubre sede adicional, certificación, capacitación, etc. |

Las tablas no se nombran `customers` ni `payments`, para evitar confusión con las de `public`.

### D2. Snapshot de precios

Al crear o enmendar un contrato, el servicio copia los montos de la versión de precio vigente a `contract_items`. Cambiar el catálogo después no altera ningún contrato existente. El SUPER_ADMIN puede ajustar `unit_amount` y `discount_amount` por contrato, lo cual es una acción crítica con motivo.

### D2b. Impuestos, prueba y día de corte

- **Impuesto:** se reutiliza el modelo de MANUS. La versión de precio apunta a un impuesto de `public.taxes` del tenant plataforma (hoy IVA 19% con `is_included=true`). El contrato guarda un snapshot del nombre, la tasa y el indicador de inclusión, para que un cambio posterior del impuesto no altere contratos firmados. `public.taxes.rate` se guarda como fracción (`0.1900` = 19%, verificado en la base local el 2026-11-08). El desglose se calcula como `base = total / (1 + rate)` cuando el precio incluye el impuesto, y como `total = base × (1 + rate)` cuando no; redondeo a pesos, mitad hacia arriba. `tax_rate_snapshot` guarda la fracción tal como viene de `taxes`. La Fase 1 solo lo muestra; el cobro llega en la Fase 2.
- **Prueba:** al crear el contrato, `trial_ends_on = start_date + default_trial_months` (hoy 1 mes). El SUPER_ADMIN puede cambiarlo o quitarlo con motivo.
- **Día de corte:** `billing_anchor_day` = día de `start_date`. En meses que no tienen ese día (29, 30 o 31), el corte cae en el último día del mes. La regla se aplica en la Fase 2.

### D3. Modelado de la propuesta actual

Ejemplos de cómo quedan los datos:

- **Componente `CERTIFICATION/ANNUAL`:** $119.000 (certificado de resolución DIAN).
- **Contrato nuevo:** `term_phase=INITIAL`, `billing_frequency=ANNUAL`, item `BASE` con $850.000 (de `BASE_INITIAL_TERM/ANNUAL`), `included_pos_terminals=1`, y N items `EXTRA_POS_TERMINAL` a $350.000/año o $29.900/mes. La certificación del primer año va incluida: ítem `CERTIFICATION` anual de $119.000 con `discount_amount = 119000` y `metadata.bonus = "INCLUIDA_TERMINO_INICIAL"`.
- **Renovación mensual:** nueva versión con `term_phase=RENEWAL`, `MONTHLY`, `BASE` $99.900, más un ítem `CERTIFICATION` anual de $119.000.
- **Renovación anual:** `RENEWAL`, `ANNUAL`, `BASE` $850.000, más un ítem `CERTIFICATION` anual de $119.000 con `discount_amount = 119000` y `metadata.bonus = "FIDELIDAD_RENOVACION_ANUAL"`. Así el beneficio queda visible y medible.

### D4. Ciclo de vida y concurrencia

- **Crear:** queda en `DRAFT` con su versión 1 e ítems.
- **Activar:** en una sola transacción se hace lock de la fila de `account_tenants` activa del tenant y de `contracts` del tenant, se valida que no haya otro `ACTIVE`, se cambia a `ACTIVE` y se audita.
- **Enmendar:** solo para `ACTIVE`. Cierra `effective_to` de la versión actual, crea la versión N+1 con `effective_from` posterior o igual y mueve `current_version_id`, todo en una transacción.
- **Terminar:** `ACTIVE` → `ENDED` con `end_date` y motivo.
- **Cancelar:** solo desde `DRAFT`.
- **Idempotencia de creación:** header `Idempotency-Key` guardado en `control_center.idempotency_keys (key, scope, response_hash, created_at)` con `UNIQUE (scope, key)`.

Acciones críticas (motivo obligatorio): activar, enmendar, terminar, desvincular un tenant, ajustar precio o descuento, modificar la prueba, retirar un plan y publicar una versión de precio.

### D5. Directorio de tenants

El directorio es una consulta de solo lectura con el pool dedicado:

`tenants` + `tenants_detalles` + conteo de `tenant_branches` activas + conteo de `pos_terminals` activas + vínculo y contrato vigente (LEFT JOIN a `control_center`).

- Paginación con keyset por `tenants.created_at, id`, `LIMIT` ≤ 50 y búsqueda por nombre, slug o NIT.
- El tenant plataforma se excluye.
- La comparación de terminales contratadas (`included_pos_terminals` + cantidad de `EXTRA_POS_TERMINAL`) frente a las activas se muestra como `OK`/`EXCEEDED`, solo informativa.

### D6. API

Todos los endpoints quedan bajo `admin/control-center` con la cadena de guards de la Fase 0.5:

- `GET tenants`, `GET tenants/:tenantId`
- `GET|POST accounts`, `GET|PATCH accounts/:id`, `POST accounts/:id/tenants`, `POST accounts/:id/tenants/:tenantId/end`
- `GET|POST plans`, `PATCH plans/:id`, `POST plans/:id/price-versions`, `GET plans/:id/price-versions`
- `GET|POST contracts`, `GET contracts/:id`, `POST contracts/:id/activate`, `POST contracts/:id/amend`, `POST contracts/:id/end`, `POST contracts/:id/cancel`

Endpoints adicionales: `GET plans/taxes` (impuestos activos del tenant plataforma para elegir en la versión de precio) y `POST contracts/preview` (ítems y totales sin persistir, para el asistente web).

Las entradas se validan con parsers puros y probados en el servicio (mismo patrón que la administración de facturación electrónica), no con `class-validator`. Los montos viajan como string decimal y se calculan en centavos con enteros (`BigInt`), nunca con `float`.

### D7. Web

Bajo `/{tenant}/control-center/`:

- `tenants`: directorio;
- `accounts`: lista, detalle y vínculo de tenants;
- `plans`: catálogo y versiones;
- `contracts`: asistente de alta con previsualización de ítems y totales antes/después de IVA (solo informativo), detalle con historial de versiones y auditoría.

## Risks / Trade-offs

- **Que `btree_gist` no esté disponible.** Mitigación: validación en el servicio con lock por plan.
- **Que el tenant plataforma no tenga configurado el impuesto en `public.taxes`.** Mitigación: el readiness lo verifica y la UI no permite publicar versiones de precio sin impuesto.
- **Divergencia entre los datos del pagador y `tenants_detalles`.** Es intencional: el pagador puede ser otra persona. El formulario permite precargar desde el tenant.

## Migration Plan

Migración aditiva en `control_center`. No hay seed de planes con precios: se crean desde la UI en cada ambiente para evitar precios codificados. Despliegue a QA y luego a PRD con el flag del Control Center ya activo.

## Open Questions

Resueltas por el propietario (2026-11-07):

- precio con IVA incluido, configurable desde la tabla de impuestos (hoy 19%);
- certificación = certificado de resolución DIAN, $119.000/año;
- prueba estándar de 1 mes;
- día de corte = día de inicio del contrato.
- certificación incluida en el año inicial (descuento del 100%).

Sin preguntas pendientes para esta fase.

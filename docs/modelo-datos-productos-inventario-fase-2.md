# Modelo de datos productos e inventario - Fase 2

## Resumen ejecutivo

Esta fase disena el modelo de datos propuesto para fortalecer productos e inventario sin implementar cambios funcionales. El modelo es aditivo y compatible con el sistema actual: `stock_movements` sigue siendo el ledger principal, `api/` conserva la logica transaccional, `backend-reporteria/` solo consulta y genera reportes/PDF/exportables, y `web/` captura o visualiza sin decidir FEFO.

El diseno permite convivir productos legacy sin lote con productos loteados, vencimientos, ubicaciones fisicas, barcodes multiples, saldos por lote/sucursal/ubicacion, historial de precios y alertas operativas.

RIESGO: Las ventas POS y pedidos usan funciones SQL criticas (`inventory_create_sale`, `inventory_invoice_order` o flujos relacionados). En Fase 3 cualquier integracion de lotes debe mantener compatibilidad transaccional y pruebas de regresion.

SUPUESTO: Esta fase no crea migraciones ejecutables. Los bloques SQL son solo diseno conceptual.

## Alcance de Fase 2

| Area | Decision |
| --- | --- |
| Producto enriquecido | Agregar metadata operativa compatible sobre `products`. |
| Barcodes | Crear tabla nueva con multiples codigos por producto y unicidad por tenant. |
| Ubicaciones | Crear catalogo de ubicaciones por tenant y sucursal. |
| Lotes | Crear lotes por producto/sucursal con costo, vencimiento y origen. |
| Saldos | Crear saldos derivados por lote/sucursal/ubicacion para performance. |
| Ledger | Mantener `stock_movements` como fuente contable principal y agregar puente a lotes. |
| Precios | Mantener `products.price` como precio actual y registrar historial. |
| Alertas | Modelar reglas configurables y alertas detectadas. |
| Migracion | Definir estrategia gradual sin obligar lote a productos existentes. |

Fuera de alcance:

- No crear archivos `.sql` ejecutables.
- No modificar funciones SQL existentes.
- No modificar endpoints, servicios, frontend ni reporteria.
- No recalcular ventas historicas.
- No activar reglas FEFO en runtime.

## Decisiones de negocio aplicadas

| Decision | Diseno aplicado |
| --- | --- |
| Proximo a vencer configurable por tenant | `inventory_alert_rules` con `threshold_days`; default recomendado 30 dias. |
| Severidades de vencimiento | `CRITICA <= 7`, `ALTA <= 15`, `PREVENTIVA <= 30`. |
| Inventario valorizado loteado | Usar `inventory_lots.unit_cost`. |
| Inventario valorizado legacy | Usar `products.cost` o costo promedio legacy si se define en migracion. |
| Productos existentes | Defaults no perecedero, no loteado, sin vencimiento obligatorio. |
| Lote legacy | Opcional solo al activar control por lote sobre saldos existentes. |
| Cambio de precio | Motivo obligatorio; sin aprobacion inicial. |
| Aprobacion futura | `product_price_history.status`, `approved_by`, `approved_at`. |
| Barcode | Multiples codigos por producto, unico por tenant, principal/alternos, no reemplaza `sku`. |

## Principios tecnicos

1. `stock_movements` permanece como ledger principal.
2. `inventory_lot_balances` es un saldo operativo derivado, no reemplaza el ledger.
3. Todo dato nuevo debe tener `tenant_id`.
4. Todo stock fisico debe ser branch-aware mediante `branch_id`.
5. FEFO debe resolverse en `api/` o funcion SQL transaccional, nunca en `web/`.
6. `backend-reporteria/` lee tablas/funciones consolidadas, no mueve stock ni cambia precios.
7. El modelo debe ser aditivo, reversible conceptualmente y tolerante a datos legacy.

## Modelo fisico propuesto

| Objeto | Tipo | Proposito |
| --- | --- | --- |
| `products` | Extension | Metadata operativa del producto. |
| `product_barcodes` | Nueva tabla | Codigos de barras multiples por producto. |
| `inventory_locations` | Nueva tabla | Ubicaciones fisicas por sucursal. |
| `inventory_lots` | Nueva tabla | Lotes con costo, vencimiento y origen. |
| `inventory_lot_balances` | Nueva tabla | Saldo disponible por lote/sucursal/ubicacion. |
| `stock_movement_lots` | Nueva tabla | Puente entre ledger y lotes consumidos/recibidos. |
| `product_price_history` | Nueva tabla | Historial/auditoria de cambios de precio. |
| `inventory_alert_rules` | Nueva tabla | Reglas configurables por tenant. |
| `inventory_alerts` | Nueva tabla | Alertas operativas detectadas. |

SUPUESTO: Las PK actuales usan `uuid`. El diseno mantiene `uuid` y recomienda `gen_random_uuid()` donde aplique, porque `pgcrypto` ya existe en scripts base.

## Extensiones sobre `products`

| Columna | Tipo recomendado | Null | Default | Regla |
| --- | --- | --- | --- | --- |
| `is_perishable` | `boolean` | No | `false` | Producto sujeto a vencimiento. |
| `requires_lot` | `boolean` | No | `false` | Exige lote en entradas/salidas futuras. |
| `requires_expiration` | `boolean` | No | `false` | Exige `expiration_date` en lotes. |
| `operational_status` | `text` | No | `ACTIVE` | CHECK de estados operativos. |
| `rotation_class` | `text` | Si | null | CHECK de clases operativas. |
| `min_stock` | `numeric(14,3)` | Si | null | Umbral minimo por producto. |
| `max_stock` | `numeric(14,3)` | Si | null | Umbral maximo por producto. |

Checks recomendados:

| Check | Regla |
| --- | --- |
| `chk_products_operational_status` | `operational_status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DISCONTINUED')`. |
| `chk_products_rotation_class` | `rotation_class IS NULL OR rotation_class IN ('HIGH', 'MEDIUM', 'LOW', 'NO_ROTATION')`. |
| `chk_products_stock_thresholds` | `min_stock IS NULL OR min_stock >= 0`; `max_stock IS NULL OR max_stock >= 0`; `max_stock >= min_stock` cuando ambos existan. |
| `chk_products_expiration_requires_lot` | Si `requires_expiration = true`, entonces `requires_lot = true`. |

SUPUESTO: `is_active` queda como compatibilidad historica. `operational_status` agrega semantica, pero Fase 3 debe definir mapeo exacto con POS/compras.

## `product_barcodes`

Proposito: permitir multiples codigos por producto sin reemplazar `sku`.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `barcode` | `text` | Obligatorio; normalizar trim. |
| `barcode_type` | `text` | CHECK: `EAN13`, `EAN8`, `UPC`, `QR`, `INTERNAL`, `OTHER`. |
| `is_primary` | `boolean` | Default `false`. |
| `is_active` | `boolean` | Default `true`. |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Default `now()`. |

Restricciones:

- PK: `product_barcodes(id)`.
- FK: `tenant_id -> tenants(id)`.
- FK: `product_id -> products(id)`.
- Unique: `(tenant_id, barcode)`.
- Unique parcial: un barcode primario activo por producto: `(tenant_id, product_id) WHERE is_primary = true AND is_active = true`.
- CHECK: `length(trim(barcode)) > 0`.

PREGUNTA ABIERTA: Se debe validar formato real por `barcode_type` en DB, en API o ambos? Recomendacion: API valida formato; DB valida no vacio y unicidad.

## `inventory_locations`

Proposito: catalogar ubicaciones fisicas por sucursal.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `branch_id` | `uuid` | FK a `tenant_branches(id)`, obligatorio. |
| `code` | `text` | Codigo interno por sucursal. |
| `name` | `text` | Nombre visible. |
| `type` | `text` | CHECK: `WAREHOUSE`, `AISLE`, `RACK`, `SHELF`, `BIN`, `COOLER`, `DISPLAY`, `OTHER`. |
| `description` | `text` | Opcional. |
| `is_active` | `boolean` | Default `true`. |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Default `now()`. |

Restricciones:

- Unique: `(tenant_id, branch_id, code)`.
- CHECK: `length(trim(code)) > 0`.
- CHECK: `length(trim(name)) > 0`.

SUPUESTO: No se modela jerarquia padre/hijo en Fase 2. Si el negocio necesita bodega > pasillo > estante > bin, se puede agregar `parent_location_id` en una fase posterior.

## `inventory_lots`

Proposito: representar el lote fisico recibido o migrado.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `branch_id` | `uuid` | FK a `tenant_branches(id)`, obligatorio. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `supplier_id` | `uuid` | FK a `suppliers(id)`, nullable. |
| `purchase_id` | `uuid` | FK a `purchases(id)`, nullable. |
| `purchase_item_id` | `uuid` | FK a `purchase_items(id)`, nullable. |
| `lot_code` | `text` | Obligatorio. Para legacy se genera codigo estable. |
| `expiration_date` | `date` | Nullable; obligatorio por regla de producto si `requires_expiration = true`. |
| `received_at` | `timestamptz` | Fecha/hora de recepcion o migracion. |
| `unit_cost` | `numeric(14,2)` | Costo unitario no negativo. |
| `status` | `text` | CHECK: `ACTIVE`, `EXPIRED`, `QUARANTINED`, `DEPLETED`, `BLOCKED`, `ADJUSTED`. |
| `is_legacy` | `boolean` | Default `false`. |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Default `now()`. |

Restricciones:

- Unique recomendado: `(tenant_id, branch_id, product_id, lot_code)`.
- CHECK: `unit_cost >= 0`.
- CHECK: `length(trim(lot_code)) > 0`.
- CHECK: `expiration_date IS NULL OR expiration_date >= received_at::date` como advertencia fuerte; puede requerir excepciones por migracion.

RIESGO: La regla "producto requiere vencimiento" depende de otra tabla (`products`). No se puede cubrir con CHECK simple. Debe validarse en `api/` y, si se desea defensa extra, con trigger futuro.

## `inventory_lot_balances`

Proposito: mantener saldo operativo por lote/sucursal/ubicacion para consultas rapidas y FEFO.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `branch_id` | `uuid` | FK a `tenant_branches(id)`, obligatorio. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `lot_id` | `uuid` | FK a `inventory_lots(id)`, obligatorio. |
| `location_id` | `uuid` | FK a `inventory_locations(id)`, nullable. |
| `quantity_on_hand` | `numeric(14,3)` | Default `0`, no negativo. |
| `quantity_reserved` | `numeric(14,3)` | Default `0`, no negativo. |
| `quantity_available` | `numeric(14,3)` | Recomendado generated: `on_hand - reserved`. |
| `last_movement_at` | `timestamptz` | Ultimo movimiento aplicado. |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Default `now()`. |

Restricciones:

- CHECK: `quantity_on_hand >= 0`.
- CHECK: `quantity_reserved >= 0`.
- CHECK: `quantity_on_hand >= quantity_reserved`.
- Unique parcial con ubicacion: `(tenant_id, branch_id, product_id, lot_id, location_id) WHERE location_id IS NOT NULL`.
- Unique parcial sin ubicacion: `(tenant_id, branch_id, product_id, lot_id) WHERE location_id IS NULL`.

SUPUESTO: Si la version de PostgreSQL soporta generated columns, `quantity_available` debe ser `GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED`. Si no, `api/` debe mantenerlo dentro de la misma transaccion.

RIESGO: Este saldo puede desincronizarse del ledger. Debe existir reconciliacion periodica y pruebas automaticas.

## `stock_movement_lots`

Proposito: relacionar cada movimiento del ledger con los lotes/ubicaciones afectados.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `stock_movement_id` | `uuid` | FK a `stock_movements(id)`, obligatorio. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `lot_id` | `uuid` | FK a `inventory_lots(id)`, nullable para legacy/no loteado. |
| `location_id` | `uuid` | FK a `inventory_locations(id)`, nullable. |
| `quantity` | `numeric(14,3)` | Cantidad positiva asignada al lote. |
| `created_at` | `timestamptz` | Default `now()`. |

Restricciones:

- CHECK: `quantity > 0`.
- FK: `stock_movement_id -> stock_movements(id)`.
- Para productos loteados, `lot_id` debe ser obligatorio por validacion transaccional en `api`/SQL function.
- Para productos no loteados, se permite `lot_id IS NULL`.

Regla de consistencia:

| Regla | Validacion recomendada |
| --- | --- |
| Suma por movimiento | `SUM(stock_movement_lots.quantity)` debe igualar `stock_movements.quantity` para movimientos lotificados. |
| Producto consistente | `stock_movement_lots.product_id` debe coincidir con `stock_movements.product_id`. |
| Tenant consistente | `stock_movement_lots.tenant_id` debe coincidir con movimiento, lote y ubicacion. |

RIESGO: Las validaciones de suma son agregadas y no caben en CHECK simple. Deben validarse en transaccion y en job de reconciliacion.

## `product_price_history`

Proposito: auditar cambios de precio sin romper ventas historicas.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `previous_price` | `numeric(14,2)` | Nullable solo para semilla inicial. |
| `new_price` | `numeric(14,2)` | Obligatorio, no negativo. |
| `reason` | `text` | Obligatorio. |
| `changed_by` | `uuid` | FK a `users(id)`, obligatorio. |
| `valid_from` | `timestamptz` | Inicio de vigencia. |
| `valid_to` | `timestamptz` | Fin de vigencia, nullable. |
| `status` | `text` | Default `APPLIED`; preparado para aprobacion. |
| `approved_by` | `uuid` | FK a `users(id)`, nullable. |
| `approved_at` | `timestamptz` | Nullable. |
| `created_at` | `timestamptz` | Default `now()`. |

Estados recomendados:

- `PENDING_APPROVAL`
- `APPLIED`
- `REJECTED`
- `SUPERSEDED`
- `CANCELLED`

Restricciones:

- CHECK: `new_price >= 0`.
- CHECK: `previous_price IS NULL OR previous_price >= 0`.
- CHECK: `length(trim(reason)) > 0`.
- CHECK: `valid_to IS NULL OR valid_to > valid_from`.
- CHECK: aprobacion consistente: ambos `approved_by` y `approved_at` nulos o ambos presentes.
- Unique parcial: solo un precio aplicado vigente por producto: `(tenant_id, product_id) WHERE status = 'APPLIED' AND valid_to IS NULL`.

SUPUESTO: En primera fase, los cambios entran directamente con `status = 'APPLIED'`. `approved_by` y `approved_at` quedan null.

## `inventory_alert_rules`

Proposito: parametrizar umbrales operativos por tenant.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `alert_type` | `text` | Tipo de alerta. |
| `threshold_days` | `integer` | Nullable, no negativo. |
| `threshold_quantity` | `numeric(14,3)` | Nullable, no negativo. |
| `severity` | `text` | Severidad operativa. |
| `is_active` | `boolean` | Default `true`. |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Default `now()`. |

Tipos recomendados:

- `EXPIRING_SOON`
- `EXPIRED`
- `LOW_STOCK`
- `OUT_OF_STOCK`
- `LOW_ROTATION`
- `OVERSTOCK`

Severidades recomendadas:

- `CRITICA`
- `ALTA`
- `PREVENTIVA`
- `MEDIA`
- `BAJA`

Reglas default por tenant para vencimiento:

| Tipo | Severidad | Threshold |
| --- | --- | --- |
| `EXPIRING_SOON` | `CRITICA` | `7` dias o menos. |
| `EXPIRING_SOON` | `ALTA` | `15` dias o menos. |
| `EXPIRING_SOON` | `PREVENTIVA` | `30` dias o menos. |

Restricciones:

- CHECK: al menos uno de `threshold_days` o `threshold_quantity` debe existir segun tipo.
- CHECK: `threshold_days IS NULL OR threshold_days >= 0`.
- CHECK: `threshold_quantity IS NULL OR threshold_quantity >= 0`.
- Unique recomendado: `(tenant_id, alert_type, severity)`.

PREGUNTA ABIERTA: Para baja rotacion, el umbral debe vivir por tenant, por producto, por categoria futura o combinacion?

## `inventory_alerts`

Proposito: registrar alertas operativas detectadas para dashboard y reporteria.

| Columna | Tipo recomendado | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `tenant_id` | `uuid` | FK a `tenants(id)`, obligatorio. |
| `branch_id` | `uuid` | FK a `tenant_branches(id)`, nullable para alertas tenant-wide. |
| `product_id` | `uuid` | FK a `products(id)`, obligatorio. |
| `lot_id` | `uuid` | FK a `inventory_lots(id)`, nullable. |
| `alert_type` | `text` | Mismo dominio que reglas. |
| `severity` | `text` | Mismo dominio que reglas. |
| `status` | `text` | `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `DISMISSED`. |
| `message` | `text` | Mensaje corto para operacion. |
| `detected_at` | `timestamptz` | Fecha de deteccion. |
| `resolved_at` | `timestamptz` | Nullable. |

Restricciones:

- CHECK: `length(trim(message)) > 0`.
- CHECK: `resolved_at IS NULL OR resolved_at >= detected_at`.
- Unique parcial recomendado para evitar duplicados abiertos: `(tenant_id, branch_id, product_id, lot_id, alert_type) WHERE status IN ('OPEN', 'ACKNOWLEDGED')`.

SUPUESTO: En Fase 3 se define si las alertas se recalculan bajo demanda, por job programado o en cada movimiento critico.

## NO EJECUTAR - DISEÑO CONCEPTUAL

```sql
-- NO EJECUTAR - DISEÑO CONCEPTUAL
-- Borrador para revisar nombres, tipos y restricciones antes de crear migraciones reales.

ALTER TABLE products
  ADD COLUMN is_perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN requires_lot boolean NOT NULL DEFAULT false,
  ADD COLUMN requires_expiration boolean NOT NULL DEFAULT false,
  ADD COLUMN operational_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN rotation_class text NULL,
  ADD COLUMN min_stock numeric(14,3) NULL,
  ADD COLUMN max_stock numeric(14,3) NULL;

CREATE TABLE product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL REFERENCES products(id),
  barcode text NOT NULL,
  barcode_type text NOT NULL DEFAULT 'OTHER',
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL REFERENCES tenant_branches(id),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'OTHER',
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL REFERENCES tenant_branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  supplier_id uuid NULL REFERENCES suppliers(id),
  purchase_id uuid NULL REFERENCES purchases(id),
  purchase_item_id uuid NULL REFERENCES purchase_items(id),
  lot_code text NOT NULL,
  expiration_date date NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  is_legacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_lot_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL REFERENCES tenant_branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid NOT NULL REFERENCES inventory_lots(id),
  location_id uuid NULL REFERENCES inventory_locations(id),
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  quantity_reserved numeric(14,3) NOT NULL DEFAULT 0,
  quantity_available numeric(14,3)
    GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  last_movement_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_movement_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stock_movement_id uuid NOT NULL REFERENCES stock_movements(id),
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid NULL REFERENCES inventory_lots(id),
  location_id uuid NULL REFERENCES inventory_locations(id),
  quantity numeric(14,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL REFERENCES products(id),
  previous_price numeric(14,2) NULL,
  new_price numeric(14,2) NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  status text NOT NULL DEFAULT 'APPLIED',
  approved_by uuid NULL REFERENCES users(id),
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  alert_type text NOT NULL,
  threshold_days integer NULL,
  threshold_quantity numeric(14,3) NULL,
  severity text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NULL REFERENCES tenant_branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid NULL REFERENCES inventory_lots(id),
  alert_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  message text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);
```

## Indices recomendados

### Producto y barcode

| Indice | Proposito |
| --- | --- |
| `ux_products_tenant_id_sku` existente | Mantener SKU unico por tenant. |
| `idx_products_tenant_status` | Listar productos por tenant y estado operativo. |
| `idx_products_tenant_rotation` | Filtrar por clasificacion de rotacion. |
| `ux_product_barcodes_tenant_barcode` | Resolver escaneo por tenant. |
| `ux_product_barcodes_primary_active` | Garantizar un primario activo por producto. |
| `idx_product_barcodes_product_active` | Listar codigos de un producto. |

### Ubicaciones y lotes

| Indice | Proposito |
| --- | --- |
| `ux_inventory_locations_tenant_branch_code` | Codigo unico por sucursal. |
| `idx_inventory_locations_branch_active` | Listar ubicaciones activas. |
| `ux_inventory_lots_tenant_branch_product_code` | Evitar duplicar lote por producto/sucursal. |
| `idx_inventory_lots_fefo` | FEFO por tenant/sucursal/producto/status/expiration/received. |
| `idx_inventory_lots_expiration` | Reportes de vencimiento. |
| `idx_inventory_lots_purchase_item` | Trazabilidad compra -> lote. |

Indice FEFO recomendado:

```sql
-- NO EJECUTAR - DISEÑO CONCEPTUAL
CREATE INDEX idx_inventory_lots_fefo
  ON inventory_lots (tenant_id, branch_id, product_id, expiration_date ASC, received_at ASC)
  WHERE status = 'ACTIVE' AND expiration_date IS NOT NULL;
```

### Saldos y movimientos

| Indice | Proposito |
| --- | --- |
| `idx_lot_balances_available_fefo` | Buscar stock disponible por producto/sucursal/lote. |
| `idx_lot_balances_location` | Filtrar por ubicacion. |
| `idx_stock_movement_lots_movement` | Trazar movimiento a lotes. |
| `idx_stock_movement_lots_lot` | Trazar lote a movimientos. |
| `idx_stock_movements_tenant_branch_product` existente | Mantener consultas agregadas legacy. |

Indice de disponibilidad recomendado:

```sql
-- NO EJECUTAR - DISEÑO CONCEPTUAL
CREATE INDEX idx_lot_balances_available_fefo
  ON inventory_lot_balances (tenant_id, branch_id, product_id, lot_id)
  WHERE quantity_available > 0;
```

### Precios y alertas

| Indice | Proposito |
| --- | --- |
| `idx_price_history_product_validity` | Consultar historial por producto y fecha. |
| `ux_price_history_current_applied` | Un precio vigente aplicado por producto. |
| `idx_alert_rules_tenant_active` | Cargar reglas activas por tenant. |
| `idx_inventory_alerts_open` | Dashboard de alertas abiertas. |
| `idx_inventory_alerts_lot` | Reportes por lote/vencimiento. |

## Estrategia multi-tenant

Cada tabla nueva incluye `tenant_id` obligatorio. Toda consulta operativa y de reporteria debe filtrar por `tenant_id`.

Recomendacion fuerte:

- Agregar FKs simples en migracion inicial para menor riesgo.
- Evaluar FKs compuestas por tenant en fase de endurecimiento: por ejemplo `(tenant_id, product_id) -> products(tenant_id, id)`.
- Para FKs compuestas se requieren unique constraints auxiliares en tablas existentes, como `products(tenant_id, id)` y `tenant_branches(tenant_id, id)`.

RIESGO: FKs simples por `id` no impiden por si solas mezclar tenant_id incorrecto si la aplicacion inserta datos mal. Fase 3 debe validar tenant en servicio/transaccion.

## Estrategia branch-aware

Reglas:

1. Todo stock fisico debe tener `branch_id`.
2. `inventory_locations` pertenece a una sola sucursal.
3. `inventory_lots` pertenece a una sucursal porque el lote fisico recibido queda en una ubicacion operativa.
4. `inventory_lot_balances` siempre tiene sucursal y puede tener ubicacion nullable.
5. `inventory_alerts.branch_id` puede ser null solo para alertas tenant-wide no fisicas.

PREGUNTA ABIERTA: Si una transferencia entre sucursales aparece en roadmap, debe crear salida del lote origen y entrada a nuevo lote/saldo en sucursal destino, conservando trazabilidad.

## Estrategia FEFO

FEFO debe resolverse en transaccion con estas reglas:

1. Filtrar `tenant_id`, `branch_id`, `product_id`.
2. Excluir lotes sin `quantity_available`.
3. Excluir lotes con `status` distinto de `ACTIVE`.
4. Para productos con vencimiento, excluir vencidos salvo regla futura explicita.
5. Ordenar por `expiration_date ASC NULLS LAST`, luego `received_at ASC`.
6. Bloquear filas de saldo candidatas con `FOR UPDATE` dentro de la transaccion.
7. Crear `stock_movements OUT`.
8. Crear uno o varios `stock_movement_lots`.
9. Actualizar `inventory_lot_balances`.

SUPUESTO: Para productos no perecederos loteados sin vencimiento, FEFO degrada a FIFO por `received_at`.

RIESGO: Si FEFO se calcula fuera de la transaccion, dos ventas concurrentes pueden consumir el mismo saldo.

## Reconciliacion ledger vs saldos

`stock_movements` es la fuente contable. `inventory_lot_balances` es una proyeccion operativa.

Reconciliacion recomendada:

| Control | Regla |
| --- | --- |
| Movimiento lotificado | Para cada `stock_movements.id` nuevo de producto loteado, existe al menos un `stock_movement_lots`. |
| Cantidad por movimiento | La suma de `stock_movement_lots.quantity` coincide con `stock_movements.quantity`. |
| Saldos por lote | Suma IN - OUT de `stock_movement_lots` coincide con `inventory_lot_balances.quantity_on_hand`. |
| Stock agregado | Suma de saldos loteados mas stock legacy coincide con stock calculado desde `stock_movements`. |
| Tenant/sucursal | `tenant_id` y `branch_id` coinciden entre movimiento, lote, ubicacion y saldo. |

Implementacion futura:

- Funcion o vista de reconciliacion en SQL.
- Job manual/administrativo de auditoria.
- Pruebas automatizadas de compra, venta, cancelacion y pedido.

## Estrategia para productos legacy sin lote

Reglas de migracion:

1. Todos los productos existentes quedan con `is_perishable = false`, `requires_lot = false`, `requires_expiration = false`.
2. No se crean lotes automaticamente para todos los productos.
3. `stock_movements` historico sigue calculando stock agregado.
4. Si un producto legacy se activa como loteado, se debe elegir estrategia antes de vender/recibir:
   - Opcion A: solo nuevos ingresos tienen lote y el stock existente se consume como legacy hasta agotarse.
   - Opcion B: crear lote legacy por tenant/sucursal/producto para saldo existente.
5. Lote legacy sugerido: `lot_code = 'LEGACY-' || sku || '-' || branch_code`, `is_legacy = true`, `expiration_date = null`, `unit_cost = products.cost` o costo promedio validado.

Recomendacion:

- Usar Opcion A para bajo riesgo si no se necesita trazabilidad retroactiva.
- Usar Opcion B solo cuando se active `requires_lot` y exista saldo actual que debe venderse con control de lote.

RIESGO: Crear lotes legacy masivos sin reconciliar saldos puede duplicar stock si tambien se sigue usando stock agregado.

## Estrategia para compras parciales

Reglas:

1. `inventory_lots` se crea solo por cantidad recibida.
2. `purchase_items.received_quantity` sigue siendo el control de cantidad recibida.
3. Cada recepcion parcial puede crear uno o varios lotes para el mismo `purchase_item_id`.
4. `inventory_lot_balances.quantity_on_hand` aumenta solo por la cantidad recibida.
5. Liquidacion parcial no crea lotes por cantidades no recibidas.
6. Cancelacion de compra sin recepcion no debe crear ni modificar lotes.

RIESGO: La tabla `purchase_items` actual no tiene `tenant_id`; se debe derivar por `purchases.tenant_id` o evaluar agregarlo en una migracion futura si se quiere FK compuesta fuerte.

## Estrategia para ventas POS y cancelacion

Venta POS:

1. Para producto no loteado, mantener flujo actual con `stock_movements OUT`.
2. Para producto loteado, resolver lotes por FEFO dentro de la funcion/transaccion.
3. Insertar `stock_movements OUT` como hoy.
4. Insertar `stock_movement_lots` con las cantidades por lote.
5. Descontar `inventory_lot_balances`.

Cancelacion:

1. Buscar los `stock_movement_lots` de la venta original.
2. Crear movimiento reverso `IN` como hoy.
3. Insertar `stock_movement_lots` reversos contra los mismos `lot_id` y `location_id`.
4. Reponer `inventory_lot_balances`.
5. No recalcular precio historico ni ticket viejo.

RIESGO: Si una cancelacion no usa el detalle original de lotes, puede reponer a un lote incorrecto.

## Estrategia para pedidos/facturacion

Reglas:

1. Entrega de pedido debe usar la misma logica FEFO de POS.
2. La facturacion de pedido no debe duplicar descuento si el stock ya salio en entrega.
3. `stock_movement_lots` debe permitir rastrear salidas originadas por `orders`.
4. Si existen pedidos parcialmente entregados, cada salida debe mapear los lotes consumidos.

PREGUNTA ABIERTA: Confirmar si `inventory_invoice_order` crea movimientos o solo factura entregas en todas las rutas actuales, porque el diagnostico muestra flujos mixtos entre servicios y funciones.

## Estrategia para reporteria

`backend-reporteria/` debe consultar datos consolidados sin modificar estado.

Reportes habilitados por el modelo:

| Reporte | Fuente principal |
| --- | --- |
| Proximos a vencer | `inventory_lots` + `inventory_lot_balances` + reglas de alertas. |
| Vencidos | `inventory_lots` con `expiration_date < current_date` y saldo disponible. |
| Baja rotacion | `stock_movements OUT` por periodo + `products.rotation_class`/reglas. |
| Inventario valorizado | `inventory_lot_balances.quantity_available * inventory_lots.unit_cost`; legacy con `products.cost` o costo promedio. |
| Historial de precios | `product_price_history`. |
| Alertas operativas | `inventory_alerts`. |

Regla de compatibilidad:

- Reportes existentes de ventas, compras, caja, tickets y pedidos no deben cambiar contrato.
- Nuevos reportes deben usar funciones/rutas separadas.

## Rollback conceptual

Como el modelo es aditivo, el rollback conceptual no requiere borrar datos inmediatamente.

Pasos:

1. Desactivar flags funcionales en `api` para no exigir lote/vencimiento.
2. Ignorar `inventory_lots`, `inventory_lot_balances` y `stock_movement_lots` en flujos operativos.
3. Mantener `stock_movements` como fuente unica de stock agregado.
4. Mantener `products.price` como precio actual aunque exista historial.
5. Pausar generacion de alertas.
6. Ocultar vistas nuevas en `web` mediante permisos/menu si ya existieran en fases futuras.
7. Respaldar tablas nuevas antes de cualquier drop real.

SUPUESTO: Drop fisico de tablas nuevas solo debe considerarse despues de validar que no hay movimientos nuevos dependientes y que POS/compras/pedidos volvieron al flujo anterior.

## Riesgos y validaciones de datos

| Riesgo | Validacion/Mitigacion |
| --- | --- |
| Producto con `requires_expiration = true` y `requires_lot = false` | CHECK o validacion API. |
| Barcode duplicado por tenant | Unique `(tenant_id, barcode)`. |
| Ubicacion mezclada entre tenant/sucursal | Validacion API y posible FK compuesta futura. |
| Lote sin vencimiento para producto que lo exige | Validacion transaccional API/SQL. |
| Saldo negativo por lote | CHECK y bloqueo transaccional. |
| Suma de lotes distinta al movimiento | Reconciliacion automatica. |
| Ventas historicas recalculadas | Prohibido; `sale_items.price` queda intacto. |
| Precio vigente solapado | Unique parcial y cierre de `valid_to` anterior. |
| Doble descuento en pedidos facturados | Pruebas de entrega/facturacion y regla unica de salida. |
| Reporteria lenta por vencimientos | Indices FEFO/vencimiento y filtros tenant/branch. |

## Pendiente para Fase 3

1. Definir migraciones SQL reales con `IF NOT EXISTS` y estrategia de backfill.
2. Decidir si se agregan FKs compuestas tenant-aware desde la primera migracion o en endurecimiento posterior.
3. Definir implementacion exacta de FEFO en `inventory_create_sale` y flujo de pedidos.
4. Definir servicio transaccional para actualizar `stock_movements`, `stock_movement_lots` y `inventory_lot_balances` juntos.
5. Definir job o endpoint administrativo de reconciliacion.
6. Definir reglas de alertas: bajo stock, vencimiento, agotado, baja rotacion y sobrestock.
7. Definir permisos/menu para pantallas y reportes nuevos.
8. Definir tests de regresion POS, compras, cancelaciones, pedidos, reporteria y multi-tenant.

## Preguntas abiertas antes de migraciones reales

1. PREGUNTA ABIERTA: Que version exacta de PostgreSQL se usara en produccion? Importa para generated columns.
2. PREGUNTA ABIERTA: Se quiere FK compuesta tenant-aware en Fase 3 inicial o despues de estabilizar datos?
3. PREGUNTA ABIERTA: El stock legacy al activar lote se consume sin lote o se convierte a lote legacy?
4. PREGUNTA ABIERTA: Se permitira vender lote vencido con permiso especial, o siempre bloqueado?
5. PREGUNTA ABIERTA: La ubicacion fisica sera obligatoria para todos los lotes o solo opcional por sucursal?
6. PREGUNTA ABIERTA: La baja rotacion se parametriza por tenant, producto, categoria futura o sucursal?
7. PREGUNTA ABIERTA: Se necesita transferencia entre sucursales en el mismo cambio o queda fuera?
8. PREGUNTA ABIERTA: El historial de precios debe permitir precios futuros programados en primera implementacion?
9. PREGUNTA ABIERTA: Inventario valorizado legacy usara `products.cost` actual o se calculara costo promedio desde compras historicas?
10. PREGUNTA ABIERTA: Las alertas se recalculan por job, por movimiento, bajo demanda o mezcla?

# Modulo de Cajas y Turno actual

Documento operativo del estado actual del modulo (API + reporteria + web), con el comportamiento de **sesion de caja**, **cierre multi-cajero** y **Turno actual = dia calendario America/Bogota**.

Fecha de referencia: 2026-09-23.

---

## 1. Vista rapida

| Pieza | Rol |
| --- | --- |
| **Cajas** (`cash_registers`) | Punto de recaudo por sucursal (catalogo). |
| **Sesiones** (`cash_sessions`) | Apertura/cierre de una caja en el tiempo. Estado `OPEN` / `CLOSED`. |
| **Asignaciones** (`cash_register_user_assignments`) | Quienes pueden operar esa caja (multi-cajero). |
| **Turno actual** | Consulta operativa de **hoy** sobre la sesion OPEN (ventas, pedidos, compras, movimientos, arqueos, tickets). |
| **Arqueo / cierre** (`cash_counts`) | `AUDIT` = arqueo preliminar; `CLOSING` = entrega de cierre del cajero. |

**No confundir:**

- **Sesion abierta** = la caja sigue `OPEN` (puede durar varios dias).
- **Turno actual** = solo movimientos/pagos del **dia de hoy** en esa sesion.
- **Cierre entregado (cajero)** = ese USER ya registro `CLOSING` en la sesion; no implica que la sesion ya este `CLOSED`.
- **Caja cerrada** = sesion `CLOSED` cuando **todos los cajeros requeridos** entregaron cierre (o cierre administrativo).

---

## 2. Donde vive el codigo

### Frontend (Next.js `web/`)

| Ruta UI | Archivo principal |
| --- | --- |
| Finanzas / nav | `web/modules/finance/components/FinanceSectionNav.tsx` |
| Sesiones | `web/app/[tenant]/finance/cash-sessions/page.tsx` |
| Turno actual | `web/app/[tenant]/finance/current-shift/page.tsx` |
| Cajas | `web/app/[tenant]/finance/cash-registers/` |
| Movimientos | `web/app/[tenant]/finance/cash-movements/` |
| Hook sesiones | `web/modules/finance/hooks/use-cash-sessions.ts` (o equivalente) |

### API principal (`api/`)

| Dominio | Path |
| --- | --- |
| Sesiones | `api/src/modules/finance/cash-sessions/` |
| Cajas | `api/src/modules/finance/cash-registers/` |
| Movimientos | `api/src/modules/finance/cash-movements/` |
| Prefijo HTTP | `/api/finance/cash-sessions/*` |

### Reporteria (`backend-reporteria/`)

| Dominio | Path |
| --- | --- |
| Turno actual | `backend-reporteria/src/modules/reports/current-shift-reports.service.ts` |
| Endpoint | `GET /api/reports/current-shift` |
| Puerto local tipico | `4021` (Docker `manus-reporteria`) |

API principal tipica: `4020` (`manus-api`).

---

## 3. Modelo de datos (lo esencial)

### `cash_sessions`

- Una fila = una apertura de caja.
- Campos clave: `tenant_id`, `branch_id`, `cash_register_id`, `opened_by_user_id`, `opened_at`, `opening_amount`, `status`, cierre (`closed_*`, `closing_amount`, `expected_amount`, `difference_amount`).
- Regla: **como maximo una sesion `OPEN` por caja registradora**.

### `cash_register_user_assignments`

- Asignacion activa: `unassigned_at IS NULL`.
- Multi-cajero: varios `user_id` activos sobre el mismo `cash_register_id`.
- El USER opera la sesion OPEN si es opener **o** tiene asignacion activa.

### `payments`

- Llevan `cash_session_id` cuando el cobro queda atado a la caja.
- Ventas POS / pedidos / compras se ven en Turno via pago (y allocations).
- Ventas POS se filtran por cajero con `sale.user_id` (no solo `payment.created_by`).

### `cash_movements`

- Movimientos de caja con `cash_session_id`.
- Tipos internos automaticos: `OPENING`, `CLOSING`, `PAYMENT` (no se crean a mano desde UI de movimientos internos).

### `cash_counts`

- `count_type = 'AUDIT'`: arqueo preliminar.
- `count_type = 'CLOSING'`: entrega de cierre del cajero para esa sesion.
- Un USER no puede entregar dos `CLOSING` en la misma sesion.

### Domicilios

- Si existe schema de caja en `deliveries` (`cash_session_id`, fees, etc.), el resumen incluye fees de entregados en el alcance del cajero/dia.

---

## 4. Roles y permisos operativos

| Rol | Comportamiento tipico |
| --- | --- |
| `USER` | Ve/opera su caja (opener o asignado). Totales y listados **scoped** a su `user_id`. Entrega **su** cierre. |
| `ADMIN` | Sucursal: puede ver caja abierta de la sucursal, filtrar por cajero, cierre administrativo. |
| `SUPER_USER` / `SUPER_ADMIN` | Alcance tenant / global segun guards; pueden elegir sesion/caja. |

Helpers en servicio:

- `canAdminCash` → ADMIN / SUPER_*
- `canOpenCash` → admin o USER
- `canOperateCashSession` → admin, o opener, o asignacion activa

---

## 5. Flujo de sesion (Sesiones)

### Abrir

1. `POST /api/finance/cash-sessions/open`
2. Si la caja ya tiene sesion `OPEN` y el actor puede operarla (asignado) → **se une** a esa sesion (no crea otra).
3. Si no hay OPEN → crea sesion + movimiento `OPENING` si `openingAmount > 0`.

### Sesion actual

1. `GET /api/finance/cash-sessions/current`
2. Busca sesion `OPEN` del usuario (opener o asignado).
3. **No oculta** la sesion solo porque el USER ya entrego su `CLOSING` (POS necesita la sesion mientras siga OPEN).
4. Si **todos los cajeros requeridos** ya entregaron cierre y la sesion sigue OPEN → **reconcile**: cierra la sesion automaticamente.

### Resumen

1. `GET /api/finance/cash-sessions/:id/summary`
2. USER: totales y breakdown **solo de su operacion** (ventas propias, movimientos propios, etc.).
3. `openingAmount` en vista USER: solo si el USER es el opener; si no, `0`.
4. `closureProgress.completedUserIds` en vista USER: si **el** ya tiene `CLOSING` → UI muestra **“Cierre entregado”**.

### Cerrar / entregar cierre

**Cajero (`USER`):**

1. `POST /api/finance/cash-sessions/:id/close` con monto de cierre.
2. Crea `cash_counts` tipo `CLOSING` (no cierra la sesion todavia si faltan otros).
3. Si faltan cajeros requeridos → sesion sigue `OPEN`, respuesta con `closureProgress.isComplete = false`.
4. Si ya estan todos → cierra sesion `CLOSED` + movimiento `CLOSING` consolidado.

**Admin:**

- Puede cerrar de forma administrativa (flujo admin en el mismo endpoint).

### Arqueo

- `POST /api/finance/cash-sessions/:id/audits` → `AUDIT`.
- Bloqueado si el actor ya esta en `closureProgress.completedUserIds` (“Ya entregaste tu cierre…”).

---

## 6. Multi-cajero: quienes deben cerrar

### Regla correcta (actual)

```text
Si hay asignaciones activas en la caja:
  requiredUserIds = usuarios asignados (unassigned_at IS NULL)
Si NO hay asignaciones:
  requiredUserIds = [opened_by_user_id]
```

**No** se exige cierre al opener cuando solo abrio la caja (ej. `super.user`) y no esta asignado.

### Bug historico (ya corregido)

Antes: `required = opener + asignados`.

Efecto:

- Opener fantasma nunca entregaba cierre.
- Los 2 cajeros ya habian entregado `CLOSING`.
- Sesion quedaba `OPEN` eterna.
- UI: “1 sesion abierta” + “Cierre entregado” → cajero bloqueado sin poder terminar la caja.

### Reconcile

En `getCurrent` / `getSummary` (y al completar el ultimo cierre):

- Si sesion `OPEN` y `closureProgress` completo → cierra sesion.
- Accion de auditoria: `CASH_SESSION_RECONCILED_AFTER_ALL_CASHIERS` / `CASH_SESSION_CLOSED_AFTER_ALL_CASHIERS`.

---

## 7. Turno actual (consulta operativa)

### Endpoint

`GET /api/reports/current-shift` (reporteria)

Query tipica: tenant/branch/terminal/caja/sesion, `userId` (filtro admin), page/search.

### Semantica de “turno”

**Turno actual = dia calendario de hoy en `America/Bogota`**, dentro de la sesion OPEN.

Filtro SQL (patron):

```sql
(column AT TIME ZONE 'America/Bogota')::date
  = (now() AT TIME ZONE 'America/Bogota')::date
```

Aplica a:

- Ventas / pedidos / compras (via `payment.created_at`)
- Movimientos (`movement.created_at`)
- Arqueos (`counted_at`)
- Domicilios (`delivery.created_at`)
- Totales del resumen (`current-shift: today-totals`)

**No** usa `finance_cash_session_summary` para el resumen del turno (ese resumen es de toda la sesion multi-dia).

### Scope por usuario

| Actor | Ventas | Pedidos/compras/movimientos |
| --- | --- | --- |
| USER | `sale.user_id = actor` | `created_by = actor` (segun entidad) |
| ADMIN + `userId` | mismo filtro al cajero elegido | igual |
| ADMIN sin filtro | toda la caja hoy | toda la caja hoy |

### Resumen del turno

- `posSalesTotal` / pedidos / compras = sumas de **hoy** (query agregada, no solo la pagina).
- Opening: opener scoped cuando hay `userId`; si no, opening de la sesion.
- Expected ≈ opening + ventas/pedidos/fees hoy − compras hoy (sin doble contar movimientos `PAYMENT`).

### UI

- Ruta: `/{tenant}/finance/current-shift`
- Tabs: ventas, pedidos, compras, movimientos, arqueo, tickets.
- Copy: turno = operaciones de **hoy**, sin mezclar dias previos ni cajas ajenas.
- Si el USER ya entrego cierre pero la sesion sigue OPEN: mensaje de consulta en solo lectura (reporteria).

---

## 8. UI Sesiones: estados que se ven

| Indicador | Significado |
| --- | --- |
| Sesiones abiertas = N | Cuenta de sesiones `OPEN` en el alcance del listado/historial. |
| Caja actual = nombre / “Abierta” | Hay sesion OPEN operable y el USER **no** ha entregado su cierre. |
| Caja actual = “Cierre entregado” | USER tiene `CLOSING` en esa sesion OPEN (o ya reconciliada). |
| Monto apertura $0 (USER) | Normal si el USER **no** es quien abrio la caja. |
| “Ya entregaste tu cierre…” | Bloquea acciones de cierre/arqueo para ese USER en esa sesion. |

Si ves **abierta + cierre entregado** y nadie mas pendiente:

1. Revisar asignados activos vs opener.
2. Revisar `cash_counts` tipo `CLOSING` por usuario.
3. Tras el fix de required/reconcile, al refrescar deberia cerrar o desaparecer de “actual”.

---

## 9. Endpoints utiles

### API (`:4020`)

```text
POST   /api/finance/cash-sessions/open
GET    /api/finance/cash-sessions/current
GET    /api/finance/cash-sessions/history
GET    /api/finance/cash-sessions/:id/summary
POST   /api/finance/cash-sessions/:id/close
GET    /api/finance/cash-sessions/:id/audit-preview
GET    /api/finance/cash-sessions/:id/audits
POST   /api/finance/cash-sessions/:id/audits
```

### Reporteria (`:4021`)

```text
GET    /api/reports/current-shift
```

Tickets relacionados (misma reporteria): POS, pedidos, compras, cierre, arqueo.

---

## 10. Checklist de diagnostico rapido

1. **Sesion OPEN de la caja**

```sql
SELECT id, status, opened_at, opened_by_user_id
FROM cash_sessions
WHERE cash_register_id = :register_id AND status = 'OPEN';
```

2. **Asignados activos**

```sql
SELECT user_id, assigned_at, unassigned_at
FROM cash_register_user_assignments
WHERE cash_register_id = :register_id AND unassigned_at IS NULL;
```

3. **Cierres / arqueos de la sesion**

```sql
SELECT count_type, counted_by_user_id, counted_at, counted_cash_amount
FROM cash_counts
WHERE cash_session_id = :session_id
ORDER BY counted_at;
```

4. **Quien debe cerrar**

- Si hay filas en (2) → esos `user_id`.
- Si (2) vacio → solo `opened_by_user_id`.

5. **Turno hoy**

- Totales de Turno actual no deben incluir pagos de dias anteriores aunque la sesion lleve abierta desde antes.

---

## 11. Docker / reinicio

Cambios en codigo montado por bind mount requieren reinicio:

```bash
docker restart manus-api
docker restart manus-reporteria
```

Tests utiles:

```bash
cd api && npx tsx --test src/modules/finance/cash-sessions/cash-sessions.service.spec.ts
cd backend-reporteria && npx tsx --test src/modules/reports/current-shift-reports.service.spec.ts
```

---

## 12. Reglas de oro (para no volver a romper)

1. **Sesion** mide vida de la caja; **turno** mide el dia.
2. Multi-cajero: cierran los **asignados**, no el opener fantasma.
3. USER con `CLOSING` no opera cierre/arqueo otra vez en la misma sesion; si la sesion sigue OPEN por otros, puede consultar turno en lectura.
4. Cuando todos los requeridos cerraron → la sesion **debe** pasar a `CLOSED` (inmediato o por reconcile).
5. Totales de Turno actual: siempre **hoy Bogota** + scope de usuario; no mezclar caja ajena ni historico de la sesion multi-dia.
6. POS gate usa sesion `OPEN` actual (`getCurrent`), no “turno del dia” solo.

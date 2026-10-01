## Context

### Fase 1B.17A - modelo local serial

El registro local conserva `PeripheralDevice` como fuente de verdad y agrega
una configuración serial genérica opcional. El perfil `ROCHI_A01E` declara
`SCALE`, `SERIAL` y los defaults certificados `9600/8/N/1` sin puerto fijo,
unidad implícita, autorización ni estado comercial. El estado sigue en
`device-registry.state.json`, schema 1, con compatibilidad para dispositivos
anteriores que no tienen `serial`.

La persistencia local no es una relación cloud. COM/PnP solo identifica una
configuración candidata; no autentica la instalación, no prueba posesión y no
produce `REAL_AVAILABLE`.

### Fase 1B.9.1: Core tÃ©cnico y etapa visual posterior

La instalaciÃ³n tÃ©cnica y el health check terminan antes de la etapa visual de
perifÃ©ricos. El Core marca `DISCOVER_DEVICES` y `CONFIGURE_DEVICES` como
`SKIPPED` con motivo explÃ­cito de etapa interactiva y luego emite
`INSTALL_SUCCEEDED`. El WebView reutiliza discovery y sus reintentos; las
pruebas de impresora o cajÃ³n no certifican ROCHI ni habilitan ventas `REAL`.

The repository already contains the product sale model (`UNIT`, `WEIGHT`, `BOTH`), terminal peripheral settings (`scaleDeviceId`, `enableScale`), POS scale controls, a MOCK `ScaleService`, generic device registration, and a separately validated ROCHI serial driver. The current scale HTTP contract returns a simulated value and does not expose commercial freshness, source, unit verification, or capture ownership. The previous ROCHI change remains the driver and Windows QA boundary; this change defines the commercial integration only.

Relevant existing areas:

- `web/modules/inventory/components/ProductForm.tsx` and `api/src/modules/inventory/*` own the sale model and its validation.
- `web/modules/pos/components/PosScreen.tsx` and `CartSaleModal.tsx` own the current POS/cart MOCK interaction.
- `web/domains/peripherals/*` resolves terminal configuration and calls the local Agent.
- `api/src/modules/pos-terminals/*` owns tenant/branch/terminal peripheral settings.
- `backend-perifericos/src/modules/scale/*` owns the current MOCK contract and the separate ROCHI driver.
- Existing pricing and sale services remain the source of truth for commercial totals and inventory effects.

## Goals / Non-Goals

**Goals:**

- Define one commercial contract for explicit, on-demand weight capture.
- Reuse the existing product model, POS components, terminal settings, pricing, sale and inventory flows.
- Make REAL, MOCK, unavailable, stale, invalid and unverified-unit states visible and non-ambiguous.
- Bind a capture to tenant, branch, terminal, device, product and operation.
- Preserve normal unit sales when no scale is configured.
- Keep ROCHI unit handling explicit: KG must be verified; no automatic KG/LB inference.

**Non-Goals:**

- No code, migrations, endpoints, DTOs or UI implementation in this change.
- No modification to the ROCHI parser or physical serial driver.
- No metrological certification, calibration, legal-for-trade claim or commercial production enablement.
- No Linux validation or multiplatform packaging completion.
- No automatic reconnect, permanent port ownership or silent MOCK fallback.
- No replacement of `saleType`, `measurementUnit`, pricing, inventory or invoicing models.

## Decisions

### 1. Use an explicit capture operation, not a permanent connection

The first commercial lifecycle is one bounded request: resolve authorized configuration, open the device, synchronize, obtain one fresh reading, normalize to kilograms, return attribution, then close and invalidate safely. A temporary session is deferred until measured operator latency justifies it and a separate owner, TTL, cancellation and invalidation contract is approved.

Permanent connection was rejected because it increases port contention, startup coupling, stale-reading risk and accidental activation of peripherals.

### 2. Keep product semantics in the existing model

`UNIT` remains scale-independent. `WEIGHT` requires the weighing path. `BOTH` must present an explicit unit-versus-weight choice before quantity is committed. Legacy flags may help compatibility during migration, but SHALL NOT override an explicit valid `saleType`.

No product table or second commercial model is proposed.

### 3. Treat unit verification as configuration and procedure

ROCHI frames do not carry unit or stability metadata. The Agent must use explicit device configuration and an operator verification procedure. The initial commercial scope uses KG verification. LB conversion remains a model-specific driver policy and is not inferred from a frame.

`stable=true` is not part of the REAL acceptance proof. A repeated value is not metrological stability.

### 4. Separate simulation from REAL operation

The existing MOCK service and fallback configuration remain useful for development and QA. They must be labeled and must not satisfy a REAL commercial capture. An unavailable configuration or Agent error must not silently resolve to `FALLBACK_MOCK` in a weighted sale.

### 5. Use short-lived backend authorization

Before a weighted capture, the authenticated backend creates a short-lived authorization bound to the current tenant, branch when applicable, terminal, POS session, product, operation and configured device. The exact cryptographic or lookup mechanism remains an implementation gate: inspection found JWT/session validation in the API and a typed Electron bridge, but no existing Agent credential or capture token.

The Agent must corroborate the authorization with its local device registry and terminal binding. A frontend-supplied `terminalId` or `deviceId` alone is never proof. The authorization is single-use and expires on timeout, configuration revocation, terminal change, product change or connection loss.

### 6. Use transient capture evidence

Capture evidence travels with the pending commercial operation and contains source `REAL`, verified source unit `KG`, normalized kilograms, capture time, expiry, device, terminal, product, operation and a unique capture identity. Backend consumes it atomically with the existing sale transaction. No permanent scale-capture table is required for the first phase unless later audit or regulatory requirements demonstrate that need.

The existing POS context and sale idempotency flow are reusable, but `Idempotency-Key` alone is not proof of physical origin. It prevents duplicate sale creation, not replay of a scale reading.

### 7. Reuse pricing and sale pipelines

The captured quantity enters the existing cart and `/pricing/preview-line` path. Backend sale validation remains authoritative and recalculates or verifies commercial totals using the existing sale service. Capture evidence is an additional gate, not a second pricing engine.

### 8. Bind capture ownership at the trusted boundary

Frontend identifiers are hints, not proof. The backend and local Agent must corroborate tenant, branch, active terminal, configured device and operation using existing authorization/configuration mechanisms. The final contract must include a unique capture identity, expiry, source, device, terminal, product/operation association and one-use semantics, without accepting a frontend-only token as authenticity.

### 9. Prefer the existing local transport seam

The implementation should extend the existing local Agent/Electron capability rather than create a remote endpoint or a parallel service. The exact HTTP/IPC shape remains an implementation detail to be selected after confirming the current runtime trust boundary and compatibility with other peripherals.

## Fase 2C.2A: protocolo y persistencia propuestos

Esta sección es diseño. No describe funcionalidades implementadas.

### Hechos que fijan el diseño

- `terminal_devices` registra una instalación Agent por `installation_id` y contiene `tenant_id`.
- `terminal_device_bindings` vincula una instalación con una terminal del mismo tenant y limita vínculos activos.
- `pos_terminal_peripheral_settings.scale_device_id` es texto y no tiene FK hacia `terminal_devices` ni hacia el JSON local del Agent.
- `FileAgentInstallationStateStore` guarda `agent-installation-id` local con permisos `0600`; ese valor no es secreto.
- `PeripheralDevice` puede contener `descriptor.agentInstallationId`, `nativeIdentifier` y `fingerprint`, pero el registro local no es autoridad cloud.
- `backend-perifericos/src/main.ts` configura bind, CORS y Private Network Access, pero no instala autenticación de mensajes Agent.
- `ScaleController` recibe `terminalId` y `deviceId` del cliente. `ScaleService` usa el registro local y devuelve el MOCK `1.25 kg`.
- `web/domains/peripherals/api.ts` usa IPC tipado en Electron y HTTP loopback en WEB. No existe credencial Agent específica en esos canales.

### Protocolo recomendado de credencial

Se recomienda una credencial aleatoria de alta entropía por instalación Agent, no un JWT de usuario y no un hash usado como secreto HMAC.

```text
PENDING_ENROLLMENT -> ACTIVE -> ROTATING -> REVOKED
```

Enrolamiento:

1. Un administrador autenticado solicita enrolamiento para un tenant y terminal permitidos.
2. El backend crea un desafío de un solo uso y una respuesta de enrolamiento con expiración corta.
3. El instalador/Agent genera o recibe una credencial una sola vez por un canal protegido.
4. El backend guarda solo un verificador KDF y nunca devuelve el secreto después del enrolamiento.
5. El Agent guarda el secreto en Windows Credential Manager/DPAPI o equivalente aprobado. El archivo `agent-installation-id` continúa siendo solo identidad local.
6. El backend asocia la credencial a `terminal_devices.id`, tenant y estado de enrolamiento.

Petición autenticada propuesta:

```text
agentInstallationId
credentialId
requestId/nonce
audience
operation
terminalBindingId
issuedAt
expiresAt
proof
```

El servidor valida la credencial activa, la audiencia, el nonce no usado, el timestamp, la instalación, el tenant, la terminal y la operación. El Agent valida que la petición corresponda a su instalación y a su configuración local. El nonce se consume de forma atómica. La respuesta no se reutiliza.

No se recomienda almacenar el secreto en `sessionStorage`, `localStorage`, una página WEB, el renderer Electron, logs, query strings o JSON de periféricos.

Rotación y revocación:

- una sola credencial nueva puede estar en transición;
- la credencial anterior expira en una ventana corta y controlada;
- `REVOKED` bloquea inmediatamente nuevas peticiones;
- reinstalación crea una nueva instalación y revoca la anterior;
- recuperación requiere un nuevo enrolamiento administrativo;
- cada emisión, rotación y revocación genera auditoría cloud.

La biblioteca KDF, el almacén Windows y la protección del canal requieren aprobación de Seguridad. No son mecanismos existentes confirmados.

### Migración A propuesta: `terminal_device_credentials`

No se crea en esta fase. La migración debe seguir el runner de `scripts/database/migrations` y el estilo transaccional existente.

Esquema mínimo propuesto:

| Campo | Tipo propuesto | Regla |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `tenant_id` | `uuid` | FK a `tenants`, obligatorio |
| `terminal_device_id` | `uuid` | FK compuesta con `(id, tenant_id)` de `terminal_devices` |
| `credential_id` | `text` | único por instalación activa |
| `verifier` | `text`/`bytea` | KDF; nunca secreto plano |
| `status` | `text` | `PENDING`, `ACTIVE`, `ROTATING`, `REVOKED` |
| `issued_at` | `timestamptz` | obligatorio |
| `expires_at` | `timestamptz` | obligatorio para credencial temporal o rotación |
| `rotated_at` | `timestamptz` | nullable |
| `revoked_at` | `timestamptz` | nullable |
| `last_used_at` | `timestamptz` | nullable |
| `created_by` | `uuid` | actor administrativo, nullable en recuperación controlada |
| `created_at`, `updated_at` | `timestamptz` | convención existente |

Restricciones mínimas:

- FK `(terminal_device_id, tenant_id)`;
- índice `(tenant_id, status)`;
- índice por `terminal_device_id`;
- unicidad de una credencial `ACTIVE` por instalación;
- estado y fechas coherentes;
- revocación dentro de una transacción;
- no devolver `verifier` por DTO administrativo.

Extender `terminal_devices` sería menor en columnas, pero mezcla identidad de instalación con historial de credenciales. Se recomienda tabla separada para rotación, auditoría y revocación.

### Migración B propuesta: `terminal_scale_bindings`

Esquema mínimo propuesto:

| Campo | Tipo propuesto | Regla |
|---|---|---|
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK a `tenants` |
| `branch_id` | `uuid` | FK a `tenant_branches` del mismo tenant |
| `terminal_id` | `uuid` | FK compuesta a terminal y tenant |
| `terminal_device_id` | `uuid` | FK compuesta a `terminal_devices` y tenant |
| `logical_scale_id` | `text` | ID lógico declarado por Agent; no COM/PnP |
| `status` | `text` | `PENDING`, `ACTIVE`, `REVOKED`, `UNBOUND` |
| `unit_verified` | `boolean` | false por defecto |
| `unit_verified_at` | `timestamptz` | nullable |
| `last_probe_at` | `timestamptz` | nullable |
| `last_observed_at` | `timestamptz` | nullable |
| `revoked_at`, `revocation_reason` | según convención | nullable |
| `created_at`, `updated_at` | `timestamptz` | convención existente |

Restricciones mínimas:

- FK tenant-terminal-sucursal;
- FK tenant-terminal-device;
- terminal activa y Agent no revocado antes de activar;
- índice parcial para un binding `ACTIVE` por terminal;
- índice parcial para un binding `ACTIVE` por `(terminal_device_id, logical_scale_id)`;
- rechazo de duplicados activos;
- transacción única para reemplazo y revocación;
- `branch_id` debe coincidir con la terminal;
- no FK hacia `PeripheralDevice`, porque ese registro es local al Agent.

`pos_terminal_peripheral_settings.scale_device_id` sigue siendo compatible. La nueva relación sería autoridad para clasificación REAL futura. Un ID administrativo no coincidente con `logical_scale_id` produce `UNKNOWN` y bloqueo.

### Contratos propuestos

No son endpoints existentes.

1. Enrolamiento Agent: emitir desafío, aceptar prueba, crear o rotar credencial.
2. Binding Agent-terminal: reutilizar `POST /terminal-device-bindings` y añadir validación de credencial Agent cuando el binding sea operativo.
3. Binding SCALE: operación administrativa transaccional para crear, reemplazar, habilitar y revocar `terminal_scale_bindings`.
4. Probe local: Agent autenticado declara `logicalScaleId`, descriptor opaco, driver, `unitVerified`, timestamp y `requestId`.
5. Estado: backend publica de forma aditiva `agentBinding`, `scaleBinding`, `physicalState`, `unitState`, `observedAt` y `expiresAt` solo cuando estén respaldados.
6. `/pos-terminals/resolve-current` conserva `source`, `scaleDeviceId`, `features.scale` y el bloque `scale` de Fase 2B. Sin prueba Agent conserva `UNKNOWN`.

`REAL_AVAILABLE` requiere vínculo activo, credencial activa, probe autenticado reciente, dispositivo local coincidente, KG verificado y TTL vigente. No autoriza por sí mismo una venta; la autorización corta y la evidencia consumible siguen siendo posteriores.

### Transporte

Electron debe usar el bridge tipado existente. El renderer no guarda ni firma con la credencial. El proceso principal solicita al backend el desafío y habla con el Agent autorizado.

WEB usa hoy HTTP loopback y CORS. Eso no basta. Para REAL se requiere un handshake de un solo uso: backend emite desafío, navegador lo entrega al Agent, Agent responde con prueba, backend valida y devuelve solo estado temporal. Si el navegador no puede completar ese handshake, permanece `UNKNOWN`. No se agrega un endpoint localhost sin autenticación.

### Amenazas y controles

| Amenaza | Control |
|---|---|
| Suplantar `installationId` | Credencial activa y binding cloud |
| Replay | Nonce consumible, timestamp y TTL |
| Robo local | Almacén OS, rotación y revocación |
| Petición maliciosa a localhost | Auth Agent, origin allowlist como capa adicional, no como identidad |
| Cross-tenant | FK compuestas y validación de actor/tenant |
| Agent revocado | Revisión transaccional antes de cada probe/estado |
| Doble asignación | Índices parciales únicos |
| Cambio USB/PnP | Estado físico local nuevo, probe nuevo y expiración |
| Fuga en logs | Nunca registrar secreto, verifier, nonce completo o COM sensible |

### Orden de implementación y rollback

1. Aprobar protocolo, KDF, almacén Windows y canal WEB.
2. Crear Migración A y servicio de enrolamiento.
3. Crear Migración B y servicio de binding.
4. Añadir middleware de autenticación al Agent.
5. Implementar Detectar/Probar sin ventas.
6. Publicar estado aditivo en `resolve-current`.
7. Adaptar Electron y bloquear WEB hasta cerrar su handshake.
8. Probar revocación, expiración y aislamiento.

Rollback: desactivar la capacidad, revocar credenciales y bindings, conservar las columnas y configuraciones antiguas, devolver `UNKNOWN`, y no eliminar migraciones con datos activos. No se toca `mock-scale-001`.

## AS-IS and gap

- Product sale model is persisted and validated, but POS handling of `BOTH` is not an explicit mode-selection flow.
- POS now resolves the effective terminal configuration before rendering scale UI; the Fase 1 guard does not read `mock-scale-001` or treat MOCK `stable` as commercial evidence.
- `ScaleService` returns a simulated `1.25 kg`; ROCHI is not wired into the commercial ScaleModule.
- Terminal settings already expose `scaleDeviceId`, `enableScale`, modes and configuration sources.
- Device registration/bindings are generic and do not yet prove ROCHI COM/PnP ownership.
- Current sale payloads carry quantity and price, but no trusted capture evidence.
- Before Fase 1, `/pos` derived visibility from public feature flags and could render a green `Balanza Lista/Listo` state without proving terminal assignment or REAL availability. Fase 1 removes that path and shows only neutral configured state until the REAL Agent contract exists.
- Fase 1 also rejects the documented `mock-scale-001` assignment for commercial visibility, even when the API reports `source=CONFIGURED` and `features.scale=true`. This is a bounded compatibility guard, not a definitive REAL-device classification; the resolve contract still needs origin/connection metadata for the final solution.
- The current cart quantity input does not expose a separate manual-weight permission or audit origin.
- `Contra Muslo` was reported by the operator as `BOTH` with `KG`, but no matching record was found in accessible repository data; it is a fixture for acceptance, not verified database evidence.

## Terminal visibility rule

When the active terminal has no assigned and enabled scale, `/pos` must render no permanent scale indicator, connection badge, live weight, scale panel or scale-only control. Unit sales remain available. If the operator selects a product or mode that requires weight, POS may show a contextual explanation and stop the capture; that explanation must not become a permanent dashboard state.

When configuration lookup fails, the commercial state is fail-closed: no operational scale controls and no `FALLBACK_MOCK` for a weighted sale. When a scale is configured, the UI may show only a state backed by resolved terminal configuration and Agent status: available REAL, disconnected, error, unit unverified, pending or invalid. `stable=true` from the MOCK service cannot produce `Balanza Lista` for REAL operation.

## Contra Muslo acceptance fixture

The operator-reported fixture is:

- product: `Contra Muslo`;
- sale model: `BOTH` / Unidad y peso;
- measurement unit: `KG`.

The fixture must be resolved from the real catalog during implementation if available. If it is absent, tests may use an explicit fixture with these values and must report that the database record was not verified. No price, stock or quantity is assumed.

Required observable behavior:

- unit mode preserves the existing unit/cart/pricing flow without a scale;
- weight mode requires REAL ROCHI capture and KG verification;
- a terminal without a configured scale hides permanent scale UI and keeps unit mode usable;
- a weight attempt without a scale shows only a contextual warning and blocks REAL capture;
- stale, disconnected, ambiguous-unit, duplicate or expired evidence blocks confirmation.

## Risks / Trade-offs

- [Risk] A configuration lookup failure falls back to MOCK. → Commercial weighted flows must fail closed when REAL is required.
- [Risk] ROCHI does not identify unit or stability. → Require explicit KG verification and reject unit ambiguity; do not infer stability.
- [Risk] A stale reading can be reused after disconnect or product change. → Central invalidation, TTL, operation binding and one-use capture identity.
- [Risk] `BOTH` can be sold through a generic quantity path. → Require an explicit mode before pricing and sale confirmation.
- [Risk] Agent local transport may trust caller-supplied IDs. → Revalidate against terminal configuration and the existing local trust boundary.
- [Risk] New capture evidence can break legacy unit sales. → Apply the additional gate only to weighted branches; preserve `UNIT` behavior.
- [Risk] Physical QA does not prove legal metrology. → Keep homologation and commercial authorization outside this change.

## Migration Plan

1. Implement the contract behind existing MOCK behavior and keep normal unit sales unchanged.
2. Add simulator tests for each state before enabling REAL selection.
3. Wire the already validated ROCHI adapter only for explicitly configured REAL terminals.
4. Enable a controlled QA flag or terminal setting for non-production validation.
5. Run POS-Agent integration tests and physical Windows QA with KG verification.
6. Roll back by disabling the scale feature or REAL terminal assignment; do not delete product sale fields or alter historical sales.

## Approved decisions and remaining implementation gates

Approved for the first phase:

1. Short-lived backend authorization bound to tenant, branch when applicable, terminal, POS session, product, operation and device.
2. No manual weight substitute for `WEIGHT` or the weight mode of `BOTH`; unit sales remain manual as today.
3. Transient, expiring, single-use REAL evidence consumed atomically with the sale; no permanent capture persistence initially.
4. One open-read-close request per weighing operation; temporary sessions are later evolution only.
5. Physical KG configuration and verification required; no automatic KG/LB or stability inference.

Still requiring technical inspection during implementation:

- exact signature, nonce or server-side lookup mechanism for the authorization;
- exact bridge/API transport extension compatible with the existing Electron capability;
- exact place to carry evidence through `/sales` while preserving current DTO validation and idempotency;
- exact UI state source after terminal configuration resolution and Agent health response.

### Fase 2B implementada: extension conservadora de `resolve-current`

La respuesta incorpora de forma aditiva un bloque `scale` separado de `settings`:

```text
scale: {
  assignment: ASSIGNED | NONE,
  deviceId: string | null,
  classification: MOCK | UNKNOWN
}
```

`MOCK` solo se emite para el fixture documentado `mock-scale-001`. Un ID distinto no se interpreta como REAL: se emite `UNKNOWN`. `assignment=ASSIGNED` prueba asignacion administrativa dentro del terminal autorizado, no posesion fisica, conexion, unidad KG ni disponibilidad. La clasificacion REAL/Agent, estados fisicos, autorizacion y revocacion durante pesaje requieren una fase posterior. Ante ausencia o error, POS falla cerrado.

## Fase 2A — identidad, registro y vinculación

Esta sección es diseño documental. Los contratos descritos como propuestos no existen todavía y no deben ser consumidos por POS ni por ventas.

### Hechos confirmados

- La fuente administrativa de asignación es `api/src/modules/pos-terminals/pos-terminals.service.ts`, su repository y `pos_terminal_peripheral_settings`; la asignación actual usa `scale_device_id` y `enable_scale`.
- `api/src/modules/pos-terminals/pos-terminals.service.ts` resuelve tenant, sucursal, terminal operativa y configuración, y `buildResolvedResponse()` expone `source`, IDs, modo y flags. No expone origen REAL/MOCK confiable, instalación Agent, PnP, COM, unidad verificada ni conexión física.
- `api/src/modules/terminal-devices/terminal-devices.service.ts` y su repository registran instalaciones en `terminal_devices` y vínculos en `terminal_device_bindings`. La relación es de instalación cloud con terminal, no de balanza física con puerto serial.
- `backend-perifericos/src/shared/types/peripheral.types.ts` define `DeviceType.SCALE`, `ConnectionType.MOCK|USB|SERIAL` y estados del dispositivo. `DevicesService` persiste un registro local JSON y siembra `mock-scale-001` como `SCALE`, `MOCK`, `CONNECTED`.
- `backend-perifericos/src/modules/scale/scale.service.ts` y `scale.controller.ts` exponen la lectura MOCK actual. La respuesta tiene dispositivo, peso, unidad, `stable` y timestamp, pero no `source` y no invoca el driver ROCHI.
- `backend-perifericos/src/modules/scale/rochi-a01e.serial.ts` es un driver separado, validado en Windows, con invalidación y reconexión explícita. Este cambio no lo modifica.
- `web/domains/peripherals/types.ts` y `terminal-config.ts` consumen configuración; el frontend no recibe hoy la clasificación física confiable.

### AS-IS

```text
tenant/sucursal -> pos_terminal -> pos_terminal_peripheral_settings
                         |                 scaleDeviceId + enableScale
                         v
                  resolve-current -> POS

terminal_devices -> terminal_device_bindings -> terminal comercial
Agent local -> DevicesService -> SCALE MOCK/USB/SERIAL
ScaleService -> lectura MOCK 1.25 kg
ROCHI serial driver -> QA independiente, sin conexión comercial
```

La configuración administrativa, el registro de instalación Agent y el registro local SCALE no forman aún una cadena de confianza completa. `CONFIGURED` significa configuración resuelta, no dispositivo REAL conectado.

### TO-BE propuesto, no implementado

```text
admin autorizado
  -> asigna SCALE registrado al pos_terminal del mismo tenant/sucursal
  -> vincula instalación Agent autorizada a la terminal
  -> Agent prueba identidad local SCALE y hardware ROCHI
  -> backend proyecta clasificación y estado al POS
  -> autorización corta por operación
  -> Agent abre, sincroniza, lee una vez y cierra
  -> evidencia REAL expirable se consume una sola vez con la venta
```

La identidad de instalación Agent, la identidad lógica del dispositivo y la identidad física CH340/ROCHI deben ser campos distintos. COM3, PnP y parámetros seriales pertenecen al Agent local; no deben ser la asignación global obligatoria del negocio.

## Fase 2C.1 - Diseno documental de confianza y operacion

### Estado AS-IS confirmado

```text
tenant/sucursal
      |
      v
pos_terminals -- pos_terminal_peripheral_settings.scale_device_id --> ID local SCALE
      |
      +--> terminal_device_bindings --> terminal_devices --> installation_id Agent

Agent local --> registro JSON PeripheralDevice --> deteccion USB/serial --> ROCHI
```

La cadena no esta cerrada: `terminal_device_bindings.device_id` identifica una instalacion cloud, mientras `scale_device_id` identifica un periferico local. No existe un vinculo persistente entre ambos. `installationId` se conserva como identidad administrativa, no como secreto. El canal HTTP/WebSocket local usa loopback y CORS, pero no autentica actualmente la instalacion frente al backend ni las peticiones de lectura frente al Agent.

### Contrato propuesto, no implementado

La futura resolucion de terminal debe poder devolver, de forma aditiva y fail-closed, una proyeccion similar a:

```text
scale:
  assignment: NONE | ASSIGNED | REVOKED
  classification: MOCK | UNKNOWN | REAL_REGISTERED
  agentBinding: NONE | PENDING | AUTHORIZED | REVOKED
  physicalState: UNKNOWN | DISCONNECTED | AVAILABLE | ERROR
  unitState: UNKNOWN | KG_VERIFIED | NOT_VERIFIED
  deviceId: string | null
  installationId: string | null
  observedAt: string | null
```

Estos nombres son propuesta. `REAL_REGISTERED` no significa conectado ni apto para venta. Solo una respuesta autenticada y reciente del Agent puede producir disponibilidad fisica; el POS no puede derivarla de `CONFIGURED`.

### Flujo administrativo Detectar--Probar--Vincular--Habilitar--Revocar

1. Administrador autorizado abre `/[tenant]/admin/peripherals` o el flujo de onboarding existente.
2. El backend resuelve tenant, sucursal y terminal desde la sesion y permisos; no acepta pertenencia declarada solo por frontend.
3. El Agent autenticado anuncia su instalacion y capacidades mediante el canal ya existente. Sin autenticacion verificable, el flujo queda `PENDING`.
4. El Agent ejecuta `discover` local, filtra `DeviceType.SCALE` y prueba la comunicacion ROCHI. COM, PnP, velocidad y unidad quedan locales.
5. El operador verifica KG de forma explicita. El protocolo ROCHI no permite inferir KG ni estabilidad metrologica.
6. El backend crea o confirma la asociacion terminal--instalacion--SCALE dentro del mismo tenant y sucursal. Debe impedir doble asignacion.
7. Habilitar solo publica estado administrativo. `REAL_AVAILABLE` requiere prueba Agent reciente.
8. Deshabilitar, desvincular o revocar, cambiar terminal, perder comunicacion o cambiar el dispositivo invalida estado y autorizaciones pendientes.

Electron puede usar el bridge tipado existente hacia el Agent local. WEB puede reutilizar el contrato HTTP/WebSocket permitido solo si el Agent autentica la solicitud y la vincula al backend; CORS o localhost solos no bastan. Si no existe esa autenticacion, WEB solo puede mostrar estado seguro y no probar ni habilitar pesaje REAL.

### Alternativas de confianza

| Alternativa | Cambios | Riesgo y despliegue | Decision |
|---|---|---|---|
| Credencial revocable de instalacion reutilizando `terminal_devices` y bindings | Extender registro/binding, Agent, API local y Electron/WEB; persistir referencia revocable, no secreto en frontend | Requiere provision segura, rotacion y revocacion; migracion probable | Preferida si seguridad aprueba provision |
| Desafio/respuesta entre backend y Agent | Extender Agent, API y transporte existente; asociar respuesta a nonce, terminal e instalacion | Requiere canal backend--Agent o relay autenticado; mas superficie y pruebas | Alternativa si ya existe transporte autenticado reutilizable |
| Nuevo mecanismo criptografico o nueva infraestructura | Nuevos secretos, endpoints, tablas o servicio | Cambio arquitectonico alto; no compatible con este alcance | Rechazada para implementacion inmediata |

La alternativa final necesita aprobacion humana de seguridad. No se inventa una clave, token, endpoint ni migracion como si ya existiera.

### Estados y expiracion

La asignacion administrativa, la vinculacion Agent, la prueba fisica y la disponibilidad son estados distintos. Una observacion Agent debe tener timestamp y TTL. Desconexion, error, revocacion, cambio de terminal, cambio de USB o vencimiento deben pasar a estado seguro e invalidar cualquier autorizacion pendiente. `mock-scale-001` permanece MOCK y nunca cruza el gate REAL.

### Gate para implementar

### Fase 2D implementada localmente

Se prepararon `V095__terminal_device_credentials.sql` y
`V096__terminal_scale_bindings.sql`, además de rutas administrativas bajo
`terminal-devices` y `terminal-device-bindings`. El backend no entrega tokens: recibe solo un
`credentialId` público y un verificador SHA-256 de un token generado fuera de este flujo, y nunca
devuelve el verificador. La vinculación exige tenant, sucursal, `pos_terminal`, terminal operativa,
Agent registrado y binding Agent-terminal activo; el SCALE es un `logicalScaleId` opaco y no una FK
al JSON local `PeripheralDevice`.

Las migraciones no fueron aplicadas. El enrolamiento TLS, SecureSecretStore DPAPI, anti-replay,
prueba física, disponibilidad `REAL_AVAILABLE` y captura comercial permanecen bloqueados.

No se autoriza codigo Fase 2C.1 hasta confirmar: mecanismo de autenticacion de instalacion, relacion persistente Agent--SCALE, pertenencia tenant/sucursal, canal autorizado WEB/Electron--Agent, revocacion, doble asignacion, prueba local ROCHI y rollback. La ausencia de cualquiera mantiene `UNKNOWN` y bloquea `REAL_AVAILABLE`.

### Matriz de identidad y estado

| Elemento | Existe hoy | Fuente | Límite |
|---|---|---|---|
| tenant/sucursal/terminal comercial | Sí | `pos_terminals`, `terminals`, actor y servicios POS | No prueba hardware |
| asignación SCALE | Sí | `pos_terminal_peripheral_settings.scale_device_id` | Puede apuntar al fixture MOCK |
| habilitación | Sí | `enable_scale` y `features.scale` | No prueba conexión |
| instalación Agent | Sí | `terminal_devices`, `terminal_device_bindings` | `installationId` no prueba posesión |
| dispositivo local SCALE | Sí | `DevicesService` / `PeripheralDevice` | No hay vínculo comercial seguro ni tenant en el registro local |
| origen MOCK/REAL | Parcial | `connectionType` local; `mock-scale-001` documentado | No llega en `resolve-current` |
| identidad física | Parcial | `usb`/`descriptor` potenciales en tipo local; PnP del driver | No hay contrato comercial validado |
| unidad KG verificada | No | procedimiento del driver/operador | No está en resolución administrativa |
| estado conectado | Local | `DeviceStatus`/Agent | No es estado de `resolve-current` |

### Extensión mínima propuesta para `resolve-current`

Debe ser aditiva y compatible. No se define como contrato vigente. La respuesta podría incorporar un bloque `scale` separado de `settings`:

```text
scale: {
  assignment: NONE | MOCK | REAL | DISABLED | REVOKED | PENDING,
  deviceId: string | null,
  agentInstallationId: string | null,
  authorizationState: UNAUTHORIZED | AUTHORIZED | REVOKED | UNKNOWN,
  physicalState: UNKNOWN | DISCONNECTED | AVAILABLE | ERROR,
  unitState: UNKNOWN | KG_VERIFIED | NOT_VERIFIED,
  source: CONFIGURATION | AGENT_VERIFIED | MOCK_FIXTURE
}
```

Estos nombres son propuesta y requieren revisión de los DTO existentes. `REAL` significa dispositivo registrado y autorizado, no conectado ni metrológicamente apto. Solo `AGENT_VERIFIED` podría permitir el siguiente gate de lectura; `CONFIGURATION` nunca basta. Ante ausencia, revocación, tenant/sucursal incorrectos o error, POS debe fallar cerrado.

### Registro y flujo administrativo propuesto

1. Administrador autorizado registra o selecciona una instalación Agent existente dentro del tenant.
2. El backend valida terminal activa, sucursal, tenant, estado no revocado y permisos existentes.
3. Se asigna un dispositivo `SCALE` lógico; se rechaza otro tenant, sucursal incompatible o terminal distinta.
4. La instalación Agent prueba localmente su dispositivo y comunica identidad física; el backend no guarda COM3 como requisito global.
5. El operador configura y verifica KG en el Agent; la unidad no se infiere de la trama ROCHI.
6. Deshabilitar, desvincular o revocar invalida autorizaciones pendientes y elimina disponibilidad comercial.

La UI `/[tenant]/admin/peripherals` ya carga terminal, configuración y dispositivos locales, pero la inspección no demuestra que soporte todo este flujo REAL. No se debe presentar esa pantalla como completa hasta implementar y probar los gates.

### Confianza, autorización y revocación

Alternativas a resolver durante implementación:

- consulta backend de autorización corta vinculada a la sesión POS;
- token firmado por backend y validado por Agent;
- combinación de consulta y credencial local de instalación.

La decisión debe exigir autenticidad, audiencia, tenant, sucursal, terminal, instalación, dispositivo, producto, operación, expiración, nonce/uso único y revocación. `terminalId`, `deviceId`, `installationId`, `Idempotency-Key` o `stable=true` enviados por frontend no son prueba suficiente. La opción final debe reutilizar la autenticación local existente o documentar la extensión mínima; no se inventa aquí una clave ni un endpoint.

### Estados y ciclo físico

`NONE`, `DISABLED`, `MOCK`, `PENDING`, `REAL_DISCONNECTED`, `REAL_ERROR`, `UNIT_NOT_VERIFIED` y `REAL_AVAILABLE` deben ser distinguibles. Solo `REAL_AVAILABLE` respaldado por Agent puede abrir la operación. La lectura mantiene abrir--sincronizar--leer--cerrar, invalida inmediatamente en error/cierre/desconexión y no usa estabilidad metrológica inferida. Sin Agent, sin KG verificado o tras revocación: no hay captura.

### Gates de implementación y QA

Antes de código REAL deben aprobarse: contrato aditivo de resolución; relación Agent-terminal-SCALE; prueba de posesión local; autorización corta; revocación; evidencia única; concurrencia; y pruebas de tenant cruzado. QA debe cubrir terminal sin asignación, `mock-scale-001`, REAL registrado desconectado, REAL en otra terminal/tenant, instalación revocada, cambio de terminal/sesión, autorización expirada/replay, KG dudoso y desconexión durante lectura. Ninguno de estos casos se ejecuta ni se marca completado en esta fase documental.

### Fase 1B implementada: SecureSecretStore local

`backend-perifericos/src/platform/secure-secret-store.ts` define el contrato
tipado `SecureSecretStore` con `get`, `set`, `rotate` y `delete`. El archivo
persistido usa versión `1`, protección `DPAPI_CURRENTUSER` y solo contiene el
blob cifrado en base64. El secreto original vive únicamente en memoria.

La implementación usa `powershell.exe` y la API nativa Windows `CryptProtectData`/`CryptUnprotectData`
El transporte al proceso auxiliar es stdin/stdout controlado; no usa argumentos,
variables persistentes ni logs para
transportar secretos. En Windows aplica ACL explícitas al directorio, temporal y
blob usando SID del usuario actual, SYSTEM y Administrators. Si DPAPI, Windows,
ACL, el perfil o la operación de reemplazo fallan, el store falla cerrado.

La escritura usa temporal en el mismo volumen, `fsync` y reemplazo Windows con
`File.Replace` cuando existe un valor anterior. `delete` elimina la referencia
persistida, pero no promete borrado irrecuperable de SSD o backups. En Windows,
el lock productivo es un Named Mutex por identificador; en plataformas sin esa
primitiva se conserva el mecanismo local existente.

La integración con enrolamiento, autenticación Agent-backend, TLS, nonce,
anti-replay, Electron/WEB y captura REAL no está implementada.
### Corrección de packaging Fase 1B

`backend-perifericos/scripts/package-windows-x64.mjs` ahora falla cerrado si el
runtime que ejecuta el empaquetado es menor que Node `24.21.0`. Esto evita
copiar accidentalmente un `node.exe` incompatible al artefacto Windows. No
descarga ni instala runtimes y todavía requiere ejecutar el packaging con un
runtime oficial verificable y revisar las ACL del artefacto.

### Validación final aislada de Fase 1B

La validación usó el ZIP oficial `node-v24.21.0-win-x64.zip`, cuyo SHA-256
coincidió con `SHASUMS256.txt`. `npm ci --ignore-scripts`, el build y 140/140
pruebas del Agent pasaron en la copia temporal. SecureSecretStore pasó 9/9
pruebas focalizadas y el paquete Windows ejecutó con runtime embebido
`v24.21.0`; la validación del paquete y el manifest completo pasaron 6/6. La
observación histórica 5/6 correspondía únicamente a una copia sin el fixture
Electron y no describe el artefacto certificado.

Las carreras administradas 1B.14B certificaron coordinación interproceso,
DPAPI `CurrentUser`, DACL del mutex, recuperación tras abandono, IPC, Job
Object y ausencia de huérfanos bajo `LocalService`. Los resultados antiguos de
carreras locales y ACL heredadas son históricos de pre-certificación, no el
estado productivo vigente. DPAPI `CurrentUser` tampoco protege frente a
malware bajo la misma cuenta.
### Fase 1B.6: ejecución y distribución administrada

El servicio Windows `ManusPeripheralAgent` se mantiene como vía productiva y
usa `NT AUTHORITY\\LocalService`, `Program Files` para ejecutables y
`ProgramData` para configuración, logs y estado. La Scheduled Task
`Manus Peripheral Agent` no se registra durante la instalación productiva.
El preflight rechaza una tarea existente, una identidad de servicio distinta o
un PID inesperado ocupando `127.0.0.1:4050`, pero permite actualizar el servicio
administrado que él mismo controla.

Las ACL administradas retiran herencia y ACE de `Everyone`, `Users` y
`Authenticated Users`. SYSTEM y Administrators conservan control total;
LocalService obtiene RX sobre ejecutables/configuración y Modify solo sobre
logs/estado. Las ACL previas se guardan temporalmente y se restauran si una
aplicación posterior falla. No se siguen reparse points.

El empaquetado invoca `npm-cli.js` mediante el Node compatible y `shell:false`.
No copia blobs DPAPI entre LocalService y usuarios interactivos. La exclusión
interproceso productiva está descrita en la sección siguiente.
### Fase 1B.7/1B.15: exclusion interproceso conservadora

En Windows, cada identificador validado usa un Named Mutex `Local\\ManusPeripheralAgent-<sha256>`, creado por el modo helper del ejecutable de servicio ya instalado. El helper fija
su OS thread con `runtime.LockOSThread`, mantiene el mutex durante toda la sección
crítica y solo acepta `DONE` o `ABORT` correlacionados con un token aleatorio.
La sección cubre lectura, DPAPI, temporal, `fsync`, `File.Replace`, limpieza y
liberación. `WAIT_OBJECT_0` permite continuar; `WAIT_TIMEOUT`, `WAIT_FAILED` y
`WAIT_ABANDONED` fallan cerrado. Un abandono deja el estado indeterminado y exige
recuperación administrativa; no se borran lockfiles por PID o antigüedad.

La DACL efectiva certificada por QA permite únicamente `LocalService`, `SYSTEM` y
`Administrators` con sincronización, modificación del mutex y lectura de control.
El lockfile histórico, si aparece, es solo diagnóstico y nunca autoridad. El
servicio existente coloca Node y sus hijos en un Job Object con
`KILL_ON_JOB_CLOSE`, usando `JOBOBJECT_EXTENDED_LIMIT_INFORMATION` de tamaño real;
no se crea un segundo servicio productivo. La evidencia administrada final está
en `C:\\ManusQA\\evidence\\1B14B-FINAL-20260929-164755-bcc7300e\\REPORT-FINAL.md`.

### Fase 1B.17B - diseno de discovery serial

El provider Windows enumera primero `Win32_SerialPort` y usa `Get-PnpDevice`
`Ports` como fallback read-only cuando esa clase no devuelve filas. El fallback
usa el `FriendlyName` del dispositivo de clase `Ports` solo para extraer el COM
asociado; la identidad de clasificacion sigue siendo el `InstanceId` PnP y sus
VID/PID. La clasificacion ROCHI exige exactamente `VID_1A86` + `PID_7523`,
normalizados en mayusculas. El candidato usa el pipeline existente de
`DevicesService`, se deduplica por identidad estable y se expone como
descubierto sin escribir `device-registry.state.json`.

El perfil `ROCHI_A01E` sigue siendo la fuente de defaults seriales. Discovery
no abre COM, no lee/escribe frames, no configura el Agent, no marca
`connected`, `authorized` o `REAL_AVAILABLE`, y no conecta `ScaleService`.
La ausencia de candidatos y el error de enumeracion son resultados distintos;
un error serial no corrompe ni reemplaza la lista de impresoras.

### Fase 1B.17C - configuracion y reconciliacion local

La configuracion reutiliza `DevicesService.create` y `DevicesService.update`.
`resolveProfileId` valida la compatibilidad de `ROCHI_A01E` con `SCALE` y
`SERIAL`; `resolveSerialOptionsForConnection` exige el objeto completo y
preserva `pnp`. El `FileDeviceRegistryStateStore` mantiene `schemaVersion=1`
con `serial` opcional y su reemplazo atomico existente.

Un candidato se convierte en configurado solo por una operacion explicita. En
la siguiente carga del servicio, el estado persistido se une con discovery.
La identidad logica permanece estable porque el ID deriva de PnP, mientras el
puerto puede cambiar de COM3 a otro COM. El reencuentro no crea duplicados ni
abre el puerto. `connected`, `unitVerified`, `authorized` y `realAvailable`
siguen falsos; no se instancia el driver ROCHI ni `ScaleService`.


La ruta productiva de secretos se separa de `stateDir` interactivo mediante
`PlatformPaths.secureSecretDir`. En Windows se resuelve bajo
`ProgramData\\Manus\\PeripheralAgent\\state\\secrets`, que queda dentro de la
ruta de estado administrada por el instalador y sus ACL para `LocalService`.
No se migran blobs entre perfiles DPAPI ni se elimina automaticamente un blob
en otra identidad.

La implementación productiva Windows ya no libera exclusión mediante validación
seguida de `unlink`; usa el Named Mutex y libera solo en el OS thread propietario.
La prueba adversarial de lockfile `REPLACEMENT_ALLOWED` queda como regresión
histórica y el lockfile no forma parte del protocolo de autoridad.

Si falla la aplicacion de una ACL, el rollback incluye tambien la ruta que pudo
haber cambiado parcialmente y restaura las rutas afectadas en orden inverso.
La prueba de rollback de `main_windows.go` cubre la selección de la ruta fallida;
la evidencia administrada 1B.14B certificó ACL efectiva y DPAPI bajo
`LocalService`. La validación de ownership del listener 4050 acepta el PID del
servicio o un descendiente demostrable de ese PID, y falla cerrado ante un PID
ajeno, inexistente o con ancestry incompleta.

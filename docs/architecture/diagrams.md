# Diagramas de arquitectura AS-IS

Estos diagramas son vistas documentales. Las relaciones **confirmadas** tienen evidencia de código. Las relaciones **declaradas** provienen de configuración. Las relaciones **pendientes** requieren despliegue, base o hardware externo.

## Contexto

```mermaid
flowchart LR
  Operator["Operador / administrador"] --> Web["Manus Web\nNext.js"]
  Operator --> Electron["Manus POS\nElectron online"]
  Electron --> Web
  Web --> API["API principal\nNestJS /api"]
  API --> DB[("PostgreSQL\nmulti-tenant")]
  API -. "declarado" .-> Reports["Backend reportería"]
  API -. "declarado" .-> Billing["Backend facturación"]
  Electron --> Agent["Peripheral Agent\n127.0.0.1:4050"]
  Agent -. "pendiente de QA físico" .-> Hardware["Impresora / cajón / scanner / balanza"]
  Billing -. "futuro/no certificado" .-> DIAN["DIAN o proveedor tecnológico"]
```

Fuentes: `web/`, `api/src/main.ts`, `docker-compose.yml`, `desktop/electron/agent-client.ts`, `backend-perifericos/src/main.ts`, `backend-facturacion-electronica/README.md`.

## Componentes internos de la API

```mermaid
flowchart LR
  HTTP["HTTP /api"] --> Controllers["Controllers"]
  Controllers --> Guards["JwtAuthGuard\nRolesGuard\nPermissionsGuard"]
  Guards --> Context["Actor + tenant\nbranch + terminal\nPOS/cash session"]
  Context --> Services["Domain services"]
  Services --> Repositories["Repositories / SQL"]
  Repositories --> DB[("PostgreSQL")]
  Services --> Outbox["Integration Outbox"]
  Outbox -. "configurado" .-> Billing["Backend facturación"]
  Services --> Reports["Report queries / exports"]
```

Confirmado por `app.module.ts`, `access-control.module.ts`, `jwt-auth.guard.ts`, controladores y servicios. La frontera exacta de reportería como llamada HTTP desde API no se certifica para cada flujo; parte de reportería consulta PostgreSQL directamente.

## Secuencia de autenticación y sesión

```mermaid
sequenceDiagram
  participant Client as Web / cliente
  participant Auth as AuthController
  participant Service as AuthService
  participant DB as PostgreSQL
  participant Guard as JwtAuthGuard

  Client->>Auth: POST /api/auth/login
  Auth->>Service: credenciales + metadata
  Service->>DB: valida usuario y tenant
  Service->>DB: crea auth_sessions
  Service->>DB: guarda refresh token hash
  Service-->>Client: accessToken + refreshToken
  Client->>Guard: Bearer + session_id
  Guard->>DB: valida auth_sessions activa
  Guard-->>Client: request autenticada con actor
```

Fuentes: `api/src/modules/auth/auth.controller.ts:46-97`, `api/src/modules/auth/auth.service.ts`, `api/src/common/guards/jwt-auth.guard.ts:58-100`.

## Persistencia de una operación transaccional

```mermaid
sequenceDiagram
  participant Client as Cliente
  participant Controller as Controller
  participant Service as Service
  participant Pool as DatabaseService / pg Pool
  participant DB as PostgreSQL

  Client->>Controller: POST/PATCH operación
  Controller->>Service: DTO + actor/context
  Service->>Pool: getClient()
  Service->>DB: BEGIN
  Service->>DB: SELECT tenant/branch/estado
  Service->>DB: INSERT/UPDATE entidades
  Service->>DB: COMMIT
  Service-->>Controller: respuesta
  Controller-->>Client: JSON
  Note over Service,DB: En error: ROLLBACK y release del cliente
```

Confirmado en servicios de auth, usuarios, sucursales, terminales, POS, finanzas, productos, promociones y dispositivos. No significa que todas las operaciones de todos los módulos usen la misma transacción.

## Modelo entidad-relación por dominios

```mermaid
erDiagram
  TENANTS ||--o{ TENANT_BRANCHES : owns
  TENANTS ||--o{ USERS : scopes
  USERS }o--o{ ROLES : user_roles
  USERS ||--o{ AUTH_SESSIONS : opens
  AUTH_SESSIONS ||--o{ POS_USER_SESSIONS : contextualizes
  TENANT_BRANCHES ||--o{ TERMINALS : contains
  TENANTS ||--o{ PRODUCTS : scopes
  PRODUCTS ||--o{ PRODUCT_BARCODES : identifies
  PRODUCTS ||--o{ INVENTORY_LOTS : batches
  INVENTORY_LOTS ||--o{ INVENTORY_LOT_BALANCES : balances
  PRODUCTS ||--o{ STOCK_MOVEMENTS : moves
  CUSTOMERS ||--o{ ORDERS : places
  ORDERS ||--o{ ORDER_ITEMS : contains
  CUSTOMERS ||--o{ SALES : buys
  SALES ||--o{ SALE_ITEMS : contains
  SALES ||--o{ SALE_PAYMENT_METHODS : pays
  SUPPLIERS ||--o{ PURCHASES : supplies
  PURCHASES ||--o{ PURCHASE_ITEMS : contains
  CASH_REGISTERS ||--o{ CASH_SESSIONS : opens
  CASH_SESSIONS ||--o{ CASH_MOVEMENTS : records
  PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : allocates
  SALES ||--o{ ELECTRONIC_DOCUMENTS : originates
  INTEGRATION_OUTBOX_EVENTS }o--|| SALES : publishes
```

La vista es conceptual y por dominios. Las cardinalidades y constraints exactas deben validarse contra cada migración y no solo contra el dump QA.

## Contenedores

```mermaid
flowchart TB
  subgraph Client["Clientes"]
    Browser["Browser"]
    Shell["Electron shell"]
  end
  subgraph Platform["Manus POS"]
    Web["web\nNext.js"]
    API["api\nNestJS"]
    Reports["backend-reporteria\nNestJS"]
    Billing["backend-facturacion-electronica\nNestJS"]
    Agent["backend-perifericos\nNestJS local"]
  end
  DB[("PostgreSQL")]
  Browser --> Web
  Shell --> Web
  Web --> API
  API --> DB
  API -. "REPORTS_API_BASE_URL" .-> Reports
  API -. "BILLING_BACKEND_INTERNAL_BASE_URL" .-> Billing
  API --> Outbox["integration_outbox_events"]
  Outbox --> Billing
  Shell -->|IPC + HTTP loopback| Agent
```

El compose local declara `api`, `reporteria` y `facturacion`; no declara Web, Electron ni Agent como servicios Docker. Estos últimos corren en el host según el comentario de `docker-compose.yml`.

## Secuencia Electron → Peripheral Agent

```mermaid
sequenceDiagram
  participant User as Usuario
  participant Web as Web Next.js
  participant Preload as Electron preload
  participant Main as Electron main / agent-client
  participant Agent as Peripheral Agent :4050
  participant Device as Periférico

  User->>Web: Acción de impresión, caja, scanner o balanza
  Web->>Preload: manusTerminal API
  Preload->>Main: IPC invoke
  Main->>Agent: HTTP loopback /health, /devices o acción
  Agent->>Device: MOCK o adapter REAL según configuración
  Device-->>Agent: Resultado físico o simulado
  Agent-->>Main: JSON limitado
  Main-->>Preload: Resultado
  Preload-->>Web: Estado de la acción
```

Confirmado: IPC, cliente HTTP loopback y endpoints del Agent.
Pendiente: operación física real y certificación por modelo/driver.

## No representado como AS-IS

No se dibuja operación offline, sincronización local, DIAN productivo, auto-update, firma de instaladores ni hardware certificado general. Esas capacidades aparecen como futuro, mock, feature flag o pendiente en la documentación y el código.

## B2.3: componentes de reportería

```mermaid
flowchart LR
  R["backend-reporteria"] --> AG["Auth guards\nJWT / mock dev-test / branch scope"]
  R --> RS["ReportsModule\ncontrollers + services"]
  RS --> SQL["SQL adapters"]
  SQL --> PG[("PostgreSQL\nread model shared")]
  RS --> EXP["DocumentExportService\nPDF / Excel / ticket"]
```

Confirmado: NestJS, guards, SQL directo y exportación. Pendiente: despliegue real, conexión efectiva y contrato HTTP con la API principal.

## B2.3: componentes de facturación electrónica

```mermaid
flowchart LR
  API["API Integration Outbox"] -->|"POST internal event\nBearer token"| C["Sale event controller"]
  C --> I["Inbox repository\ndedup event/source"]
  I --> P["Consumer + processing service"]
  P --> D[("electronic_documents\nlines/taxes/events")]
  P --> W["Background worker\nlease + retry"]
  P --> PR["Provider resolver"]
  PR --> F["MOCK_LOCAL / Fake"]
  PR --> FC["FactuCore adapter"]
  PR -. "DIAN_DIRECT\nfixture/local only" .-> DN["DIAN boundary"]
```

La línea punteada no certifica transmisión DIAN. La configuración declara llamadas externas deshabilitadas por defecto.

## B2.3: ciclo del Integration Outbox

```mermaid
stateDiagram-v2
  [*] --> PENDING: enqueue in sale transaction
  PENDING --> PROCESSING: claim + lease
  PROCESSING --> PUBLISHED: PUBLISHED / ALREADY_PROCESSED
  PROCESSING --> PENDING: retryable + backoff
  PROCESSING --> FAILED: ineligible / non-retryable / max attempts
  PROCESSING --> PENDING: exception before retry limit
  FAILED --> PENDING: explicit recovery creates replacement event
```

`PENDING` y `FAILED` son estados del outbox observados en código. El receptor tiene su propio inbox y estados de documento; no son la misma máquina de estados.

## B2.3: venta hacia procesamiento fiscal

```mermaid
sequenceDiagram
  participant Sale as API SaleService
  participant DB as PostgreSQL
  participant Outbox as integration_outbox_events
  participant Disp as Outbox Dispatcher
  participant Fiscal as Fiscal backend
  participant Inbox as electronic_billing_inbox_events
  participant Provider as Provider adapter

  Sale->>DB: BEGIN
  Sale->>DB: create sale, payments, finalize
  Sale->>Outbox: enqueue event with same PoolClient
  Sale->>DB: COMMIT
  Disp->>Outbox: claim due event + lease
  Disp->>Fiscal: POST /internal/electronic-billing/events/sale-completed
  Fiscal->>Inbox: validate, deduplicate, insert RECEIVED
  Fiscal->>Provider: resolve and process document
  Provider-->>Fiscal: result or temporary/terminal error
  Fiscal-->>Disp: PUBLISHED / ALREADY_PROCESSED / failure
  Disp->>Outbox: mark published, retryable, or failed
```

Confirmado: transacción de venta/outbox y contrato interno. Pendiente: recorrido real entre procesos, proveedor y ambiente; no se dibuja aceptación DIAN.

## B2.4: despliegue operativo declarado

```mermaid
flowchart TB
  subgraph Local["Desarrollo local declarado"]
    WebL["Web host"]
    PG_L[("PostgreSQL host")]
    Compose["Docker Compose"]
    APIL["API :4020"]
    RL["Reportería :4021"]
    FL["Facturación :4030"]
    Compose --> APIL
    Compose --> RL
    Compose --> FL
    APIL --> PG_L
    RL --> PG_L
    FL --> PG_L
    WebL --> APIL
  end
  subgraph QA["QA declarado"]
    PMQ["PM2 fork"]
    APIQ["API :4020"]
    RQ["Reportería :4021"]
    FQ["Facturación :4022"]
    PMQ --> APIQ
    PMQ --> RQ
    PMQ --> FQ
  end
  subgraph Prod["Producción declarada"]
    PMP["PM2"]
    APIP["emaus_api :4020"]
    RP["emaus_reporteria :4021"]
    FP["emaus_facturacion :4022"]
    WP["Web :19500"]
    PMP --> APIP
    PMP --> RP
    PMP --> FP
    PMP --> WP
  end
```

Local está respaldado por `docker-compose.yml`. QA y producción están respaldados por workflows/scripts. Ningún bloque representa una consulta al ambiente real.

## B2.4: señales y recuperación

```mermaid
flowchart LR
  S["Servicio"] --> H["Health endpoint"]
  S --> L["stdout/stderr o PM2 logs"]
  O["Outbox dispatcher"] --> C["claim + lease"]
  C -->|"éxito"| P["PUBLISHED"]
  C -->|"retryable"| B["backoff + next_attempt_at"]
  C -->|"terminal"| F["FAILED"]
  B --> C
  F --> R["recovery/manual review"]
  DB[("PostgreSQL")] --> BK["pg_dump custom"]
  BK --> RS["pg_restore controlado"]
```

Confirmado en código/scripts: health básico, logs de proceso, lease/backoff y backup/restore declarados. Pendiente: alertas, métricas, trazas, restore probado y RPO/RTO.
## B3: arquitectura interna Web

```mermaid
flowchart TB
  Root["Next.js App Router"] --> Layout["Root layout"]
  Layout --> Providers["Client Providers"]
  Providers --> Auth["AuthSessionManager"]
  Providers --> Redux["Redux store"]
  Redux --> Domains["domains + modules"]
  Domains --> HTTP["lib/http"]
  HTTP --> API["API /api"]
  HTTP --> Reports["Reporteria base URL"]
  Domains --> Peripheral["Peripheral contracts"]
  Peripheral -. "Electron only" .-> Bridge["window.manusTerminal"]
  Peripheral -. "Web/Electron configurado" .-> Agent["Peripheral Agent"]
```

Confirmado por `web/app/providers.tsx`, `web/lib/http.ts`, reporteria y
`web/domains/peripherals/`. Disponibilidad de destinos y hardware quedan sin
verificar.

## B3: autenticacion y refresh

```mermaid
sequenceDiagram
  actor U as Usuario
  participant W as Web
  participant A as API
  participant S as Session manager
  U->>W: Login
  W->>A: POST /auth/login
  A-->>W: Tokens y usuario
  W->>S: startSessionFromLogin
  S->>A: GET /auth/me, /me/menu, /me/permissions
  A-->>S: Identidad, menu y permisos
  W->>A: Request protegida
  A-->>W: 401
  W->>S: refreshSession
  S->>A: POST /auth/refresh
  A-->>S: Nuevo access token
  S->>A: Reintento unico
  A-->>W: Respuesta o 401 definitivo
```

Confirmado en `web/domains/auth/session-manager.ts` y `web/lib/http.ts`.

## B3: consumo de servicios

```mermaid
sequenceDiagram
  participant P as Pantalla Web
  participant H as apiClient
  participant A as API NestJS
  participant R as Backend reporteria
  P->>H: Operacion POS o dominio
  H->>A: /api/... + Bearer + contexto POS
  A-->>P: JSON de dominio
  P->>R: /reports/... con base de reporteria
  R-->>P: PDF, Excel, ticket o JSON
```

Web -> API y Web -> reporteria estan confirmados por clientes distintos.

## B3: Web, Electron y Agent

```mermaid
sequenceDiagram
  participant W as Web en Electron
  participant Pre as preload
  participant E as Electron main
  participant C as agent-client
  participant G as Peripheral Agent
  W->>Pre: window.manusTerminal
  Pre->>E: ipcRenderer.invoke
  E->>C: Accion local
  C->>G: HTTP loopback health, print, drawer, scale
  G-->>C: Resultado o error
  C-->>E: Respuesta
  E-->>Pre: Resultado IPC
  Pre-->>W: Contrato bridge
```

Confirmado por `desktop/electron/preload.ts`, `main.ts` y `agent-client.ts`.
En Web convencional, Agent depende de URLs configuradas y no demuestra acceso
al bridge Electron. No se representa hardware certificado, offline ni
auto-update.

## B4.1: componentes transaccionales POS

```mermaid
flowchart LR
  Web["Web PosScreen"] --> Http["web apiClient"]
  Http --> Ctrl["SaleController POST /sales"]
  Ctrl --> Guards["JWT / roles / permisos / caja / POS"]
  Ctrl --> Sale["SaleService.createSale"]
  Sale --> Price["PricingService"]
  Sale --> Repo["SaleRepository"]
  Repo --> Fn["inventory_create_sale_v2"]
  Fn --> Stock["stock_movements + lotes"]
  Sale --> Pay["PaymentsService"]
  Sale --> Outbox["IntegrationOutboxService"]
  Sale --> Idem["sale_creation_idempotency"]
  Sale --> DB[("PostgreSQL")]
  Outbox --> DB
```

Relaciones confirmadas por `web/modules/pos/services/pos.service.ts`,
`api/src/modules/inventory/controllers/sale.controller.ts`,
`api/src/modules/inventory/services/sale.service.ts` y el SQL de
`inventory_create_sale_v2`. El consumidor fiscal y su despacho se describen
en [Integration Outbox AS-IS](integration-outbox-as-is.md). No se afirma aquí
entrega exactamente una vez ni despliegue fiscal productivo.

## B4.1: venta POS exitosa y frontera de commit

```mermaid
sequenceDiagram
  actor Cajero
  participant Web as PosScreen
  participant API as SaleController
  participant S as SaleService
  participant P as PricingService
  participant DB as PostgreSQL
  participant O as Integration Outbox
  Cajero->>Web: Confirmar carrito y pagos
  Web->>API: POST /sales + Idempotency-Key
  API->>API: Guards y contexto tenant/sucursal/terminal/caja
  API->>S: createSale(context, input, key)
  S->>DB: BEGIN
  S->>DB: Reservar idempotencia y validar sesión POS
  S->>P: Calcular precio, impuestos y promoción por línea
  P-->>S: Snapshot de precio POS
  S->>DB: inventory_create_sale_v2
  DB->>DB: Insertar venta/items, stock OUT y FEFO si aplica
  S->>DB: Crear pagos y movimientos de caja
  S->>O: Encolar evento fiscal con el mismo PoolClient
  S->>DB: Completar idempotencia y COMMIT
  DB-->>API: Venta confirmada
  API-->>Web: SaleResponse
```

La secuencia representa la ruta directa confirmada. La ejecución real depende
del esquema instalado en el ambiente; QA, producción y proveedor fiscal no se
certifican desde este repositorio.

## B4.1: rechazo y rollback

```mermaid
sequenceDiagram
  participant API as SaleService
  participant DB as PostgreSQL
  participant P as PricingService
  API->>DB: BEGIN
  API->>P: Calcular precio
  P-->>API: Error o precio inválido
  API->>DB: ROLLBACK
  API-->>API: No confirma venta ni idempotencia
  API->>DB: BEGIN
  API->>DB: Validar stock, lote, pago o caja
  DB-->>API: RAISE EXCEPTION
  API->>DB: ROLLBACK
  API-->>API: Respuesta de error
```

El `catch` de `createSale` hace rollback y libera el `PoolClient`. Las
respuestas HTTP concretas dependen de la excepción NestJS. No se documenta
recuperación automática posterior al commit.

## B4.1: cancelación y compensación

```mermaid
sequenceDiagram
  participant API as POST /sales/:id/cancel
  participant S as SaleService
  participant DB as PostgreSQL
  participant Pay as PaymentsRepository
  API->>S: cancelSale(id, context)
  S->>DB: BEGIN
  S->>DB: SELECT venta FOR UPDATE
  S->>DB: Crear movimientos IN compensatorios
  S->>DB: Revertir lotes y cantidades de pedido
  S->>Pay: Crear refund y movimiento de caja si aplica
  S->>DB: Estado CANCELLED o REFUNDED
  S->>DB: COMMIT
  S-->>API: Venta cancelada
```

La compensación y sus condiciones están implementadas en
`api/src/modules/inventory/services/sale.service.ts`. Una devolución
independiente distinta de `cancelSale` no fue identificada en esta revisión.

## B4.2: arquitectura interna del frontend POS

```mermaid
flowchart TB
  Route["app/[tenant]/pos/page.tsx"] --> Screen["PosScreen"]
  Screen --> Context["usePosContext + pos slice"]
  Screen --> Cart["usePosCartStore + posCart slice"]
  Screen --> Catalog["productos, clientes, impuestos"]
  Screen --> Pricing["previewPosLinePrice"]
  Screen --> Payment["PaymentDialog"]
  Screen --> Scanner["scanner wedge / peripherals contracts"]
  Screen --> Sale["createSale / reconcileSale"]
  Sale --> HTTP["apiClient"]
  HTTP --> API["NestJS API"]
  Screen --> Print["runSalePeripheralOperations"]
  Print -. "post-commit" .-> Agent["Electron bridge / Peripheral Agent"]
```

La ruta, estado y clientes están confirmados en Web. La disponibilidad del
bridge y del Agent depende del entorno; no se presenta como requisito de venta.

## B4.2: ciclo de vida del carrito

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> DRAFT: agregar, quitar o cambiar cantidad
  DRAFT --> PRICING_PENDING: cambio de producto, cantidad, sucursal o cliente
  PRICING_PENDING --> DRAFT: preview de precio OK
  PRICING_PENDING --> PRICING_ERROR: error no recuperable
  PRICING_PENDING --> PRICING_PENDING: sin red o backend pendiente
  PRICING_ERROR --> PRICING_PENDING: reintento online
  DRAFT --> SUBMITTING: submitSale
  SUBMITTING --> CONFIRMED: respuesta 2xx
  SUBMITTING --> DRAFT: rechazo HTTP 4xx
  SUBMITTING --> UNKNOWN: timeout, red o error no definitivo
  UNKNOWN --> CONFIRMED: reconcileSale encuentra venta
  UNKNOWN --> UNKNOWN: reconciliación 404/409/error
  CONFIRMED --> DRAFT: limpiar venta y comenzar otra
```

`PRICING_PENDING` y `PRICING_ERROR` son estados de línea; `SUBMITTING`,
`UNKNOWN` y `CONFIRMED` son estados de la venta en el store del carrito.

## B4.2: cobro Web-API

```mermaid
sequenceDiagram
  actor Cajero
  participant W as PaymentDialog / PosScreen
  participant H as apiClient
  participant A as SaleController
  participant S as SaleService
  Cajero->>W: Abrir cobro
  W->>W: Validar cliente, monto, referencia e institución
  Cajero->>W: Confirmar o pulsar Enter
  W->>H: POST /sales + Idempotency-Key
  H->>H: Bearer + x-pos-session-id
  H->>A: Request autorizada
  A->>S: Venta, pagos y contexto
  S-->>A: SaleResponse o error
  A-->>H: HTTP 2xx o 4xx/5xx
  H-->>W: Resultado
  W->>W: Limpiar carrito solo con éxito
```

La validación Web mejora la experiencia, pero caja, permisos, pagos, precio y
stock siguen siendo controles backend descritos en B4.1.

## B4.2: respuesta incierta y reconciliación

```mermaid
sequenceDiagram
  participant W as PosScreen
  participant A as API
  participant DB as Sale idempotency
  W->>A: POST /sales + clave estable del intento
  A--xW: timeout, error de red o respuesta no comprobable
  W->>W: Unknown state blocks retry
  W->>A: GET sale by idempotency key
  A->>DB: Buscar tenant + clave
  alt venta encontrada
    DB-->>A: sale_id
    A-->>W: Venta confirmada
    W->>W: Limpia carrito
  else 404, 409 o error
    A-->>W: Resultado no concluyente
    W->>W: Conserva intento y no repite ciegamente
  end
```

La reconciliación es confirmada por código. No prueba que todo timeout sea
recuperable ni que exista consulta automática en segundo plano.

## B4.2: actualización del contexto operativo

```mermaid
sequenceDiagram
  participant U as Usuario
  participant C as PosContextSelector
  participant H as apiClient
  participant A as API
  participant R as Redux pos
  U->>C: Elegir tenant, sucursal y terminal
  C->>H: Consultar contexto, cajas y sesión actual
  H->>A: GET /auth/context y caja
  A-->>C: Opciones y estado de caja
  C->>H: Abrir caja si falta
  C->>H: POST /pos/session
  H-->>C: posSessionId
  C->>R: setContext + setSession
  R-->>C: Navegar a /pos
```

El frontend resuelve contexto visible. La autorización final de tenant, sucursal,
terminal, caja y sesión pertenece al backend.

## B4.3: Electron, Agent y dispositivos

```mermaid
flowchart LR
  Web["POS Web"] --> Preload["preload / window.manusTerminal"]
  Preload --> Main["Electron main"]
  Main --> Client["agent-client HTTP"]
  Client --> Agent["Peripheral Agent 127.0.0.1:4050"]
  Agent --> Resolver["PeripheralAdapterResolver"]
  Resolver --> Mock["Mock adapters"]
  Resolver --> Net["Network ESC/POS"]
  Resolver --> USB["USB system queue"]
  Agent --> Scanner["Scanner simulation/events"]
  Agent --> Scale["Scale current-weight"]
  Net --> Printer["Printer hardware"]
  USB --> Printer
  Printer --> Drawer["Cash drawer pulse"]
```

Las flechas de Web a Agent pasan por Electron cuando se usa el shell. El scanner
wedge de teclado Web tiene además una ruta independiente. El Agent y hardware
real quedan configurados o no verificados según ambiente.

## B4.3: impresión posterior a venta confirmada

```mermaid
sequenceDiagram
  participant W as PosScreen
  participant P as pos-sale-integration
  participant Pre as preload
  participant E as Electron main
  participant A as Peripheral Agent
  participant Pr as Printer adapter
  W->>W: Recibe SaleResponse 2xx
  W->>P: Construir ticket POS
  P->>Pre: printTicket(payload)
  Pre->>E: IPC manusTerminal.printTicket
  E->>A: POST /printer/print-ticket
  A->>Pr: Resolve adapter y generar ESC/POS
  Pr-->>A: Resultado o error
  A-->>E: JSON job result
  E-->>Pre: Respuesta
  Pre-->>P: Feedback de impresión
  P-->>W: Success or warning sale unchanged
```

La impresión empieza después del commit de venta. El flujo no representa
reimpresión automática ni confirmación fiscal DIAN.

## B4.3: scanner y balanza

```mermaid
sequenceDiagram
  participant U as Dispositivo o usuario
  participant W as PosScreen
  participant A as Agent
  participant API as Agent HTTP
  alt scanner wedge Web
    U->>W: Teclas rápidas + Enter
    W->>W: Validar timing y matching local
  else simulación Agent
    W->>A: simulateScanner(payload)
    A->>API: POST /scanner/simulate
    API-->>A: code, format, timestamp
    A-->>W: Resultado simulado
  end
  W->>W: Producto agregado al carrito
  W->>A: currentWeight(payload)
  A->>API: GET /scale/current-weight
  API-->>A: weight, unit, stable
  A-->>W: Lectura de peso
```

El código del Agent marca la lectura de balanza como simulada. No se afirma
exactitud metrológica ni compatibilidad de dispositivo.

## B4.3: cajón y recuperación de periférico

```mermaid
sequenceDiagram
  participant W as POS Web
  participant A as Peripheral Agent
  participant Pr as Impresora
  participant D as Cajón
  W->>A: POST /cash-drawer/open
  A->>A: Resolver impresora, perfil y certificación
  A->>Pr: Enviar pulso ESC/POS
  Pr->>D: Pulso físico si aplica
  alt éxito
    D-->>Pr: Resultado del transporte
    Pr-->>A: bytesSent / capabilities
    A-->>W: success
  else timeout o no disponible
    A-->>W: error controlado
    A->>A: Log y estado NOT_REACHABLE cuando aplica
  end
  W->>W: Show feedback sale unchanged
```

No existe una transacción PostgreSQL alrededor de esta apertura ni una garantía
de idempotencia del comando demostrada por código.

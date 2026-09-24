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

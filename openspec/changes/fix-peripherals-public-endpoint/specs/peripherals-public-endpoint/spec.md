## ADDED Requirements

### Requirement: Environment-based peripheral agent URL
The web frontend SHALL resolve the peripheral agent HTTP and WebSocket URLs from public environment configuration.

#### Scenario: Development fallback uses local agent
- **WHEN** the web app runs outside production and `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` is not set
- **THEN** the frontend SHALL use `http://localhost:4050` for HTTP requests
- **AND** the frontend SHALL use `ws://localhost:4050/peripherals` for WebSocket events

#### Scenario: Production requires HTTPS URL
- **WHEN** the web app runs in production and `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` is not set
- **THEN** the frontend SHALL mark the peripheral agent configuration as missing
- **AND** the frontend SHALL NOT call `/health`, `/devices`, or `/logs`

#### Scenario: Production rejects insecure or local URLs
- **WHEN** the web app runs in production and `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` uses `http://`, `localhost`, or `127.0.0.1`
- **THEN** the frontend SHALL mark the peripheral agent configuration as invalid
- **AND** the frontend SHALL NOT call the configured backend URL

#### Scenario: Production derives secure WebSocket URL
- **WHEN** the web app runs in production with `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=https://peripherals.example.com` and without `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL`
- **THEN** the frontend SHALL derive `wss://peripherals.example.com/peripherals` for WebSocket events

### Requirement: React components avoid hardcoded local agent URLs
React components for `/admin/peripherals` SHALL consume URLs and configuration state from the peripherals client module and SHALL NOT embed `localhost:4050`.

#### Scenario: Component displays configured endpoint
- **WHEN** `/[tenant]/admin/peripherals` renders
- **THEN** it SHALL display the resolved HTTP and WebSocket endpoint values from the client configuration
- **AND** the component source SHALL NOT contain hardcoded `localhost:4050`

### Requirement: Admin peripherals UI handles agent states
The `/[tenant]/admin/peripherals` UI SHALL show controlled states for available backend, unavailable backend, missing configuration, invalid configuration, and network/CORS errors.

#### Scenario: Backend available
- **WHEN** `GET /health`, `GET /devices`, and `GET /logs` succeed
- **THEN** the UI SHALL show the health metadata, device list, and logs without an error banner

#### Scenario: Backend offline or unreachable
- **WHEN** the agent URL is configured but fetch fails before an HTTP response is received
- **THEN** the UI SHALL show an unavailable backend state with the endpoint and a network/CORS/offline message

#### Scenario: Configuration missing
- **WHEN** the frontend marks the agent configuration as missing
- **THEN** the UI SHALL show a configuration missing state
- **AND** the UI SHALL avoid making agent HTTP requests

#### Scenario: Configuration invalid
- **WHEN** the frontend marks the agent configuration as invalid
- **THEN** the UI SHALL show a configuration invalid state explaining the HTTPS production requirement
- **AND** the UI SHALL avoid making agent HTTP requests

### Requirement: Peripheral backend CORS and preflight
`backend-perifericos` SHALL allow CORS only for configured origins and SHALL answer browser preflight requests for supported routes.

#### Scenario: Allowed origin preflight succeeds
- **WHEN** an `OPTIONS /devices` request includes an `Origin` listed in `PERIPHERALS_ALLOWED_ORIGINS`
- **THEN** `backend-perifericos` SHALL respond with status 204
- **AND** the response SHALL include the expected CORS allow-origin and allow-methods headers

#### Scenario: Curl without Origin is allowed
- **WHEN** a request to `GET /health` has no `Origin` header
- **THEN** `backend-perifericos` SHALL allow the request for local smoke checks

#### Scenario: Disallowed Origin is rejected by CORS policy
- **WHEN** a browser request includes an `Origin` not listed in `PERIPHERALS_ALLOWED_ORIGINS`
- **THEN** `backend-perifericos` SHALL NOT grant that origin in CORS response headers

### Requirement: Multi-tenant route remains stable
The peripherals admin route SHALL remain tenant-aware and SHALL preserve existing route permission behavior.

#### Scenario: Tenant route keeps same path
- **WHEN** an authorized user navigates to `/{tenant}/admin/peripherals`
- **THEN** the app SHALL render the peripherals admin UI for that tenant path
- **AND** route permission matching SHALL continue to require the existing `peripherals.manage` permission

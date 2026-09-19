# backend-reporteria

Servicio independiente de reportería para Manus Tienda.

## Endpoints base

- `GET /api/reports/health`
- `GET /api/reports/demo`
- `GET /api/reports/demo-pdf`

## Headers mock de desarrollo/test

Solo con `NODE_ENV=development` o `NODE_ENV=test` y
`REPORTS_ALLOW_MOCK_AUTH=true`, el servicio acepta headers simples:

- `x-report-user-id`
- `x-report-tenant-id`
- `x-report-branch-id`
- `x-report-role`
- `x-report-email`

Mock auth works only with `NODE_ENV=development` or `NODE_ENV=test` and
`REPORTS_ALLOW_MOCK_AUTH=true`. In `qa` and `production`, the variable is
ignored and report requests require a valid Bearer JWT. Branch scope always
comes from database assignments.

## Variables mínimas

Revisa `.env.example`.

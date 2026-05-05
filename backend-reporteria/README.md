# backend-reporteria

Servicio independiente de reportería para Manus Tienda.

## Endpoints base

- `GET /api/reports/health`
- `GET /api/reports/demo`
- `GET /api/reports/demo-pdf`

## Headers mock soportados

Si no envías JWT Bearer, el servicio acepta headers simples:

- `x-report-user-id`
- `x-report-tenant-id`
- `x-report-branch-id`
- `x-report-role`
- `x-report-email`

## Variables mínimas

Revisa `.env.example`.

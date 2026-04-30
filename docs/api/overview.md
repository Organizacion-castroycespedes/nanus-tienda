# API Overview

## Base path

Todas las rutas del backend usan prefijo global:

```text
/api
```

## Seguridad

- JWT Bearer obligatorio en endpoints protegidos
- `session_id` dentro del JWT
- validacion de sesion activa contra `auth_sessions`
- roles y permisos por menu segun endpoint

## Alcance

- Tenant: desde token y actor autenticado
- Branch/terminal: desde contexto POS o filtros validados

## Payloads de referencia

### Login

```json
{
  "email": "usuario@empresa.com",
  "password": "12345678"
}
```

### Crear sesion POS

```json
{
  "branchId": "uuid-branch",
  "terminalId": "uuid-terminal"
}
```

### Crear venta POS

```json
{
  "customerId": "uuid-customer",
  "type": "CASH",
  "items": [
    {
      "productId": "uuid-product",
      "quantity": 2,
      "price": 10000
    }
  ],
  "paymentMethods": [
    {
      "paymentMethod": "CASH",
      "amount": 20000,
      "reference": null
    }
  ]
}
```

## Respuestas tipicas

### Login

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-token"
}
```

### Sesion POS

```json
{
  "posSessionId": "uuid-session",
  "branchId": "uuid-branch",
  "terminalId": "uuid-terminal"
}
```

## Errores frecuentes

| HTTP | Caso |
|---|---|
| 400 | tenant/branch/terminal requerido, payload invalido |
| 401 | token invalido, token ausente, sesion invalida |
| 403 | acceso no autorizado por rol, tenant o permiso |
| 404 | recurso inexistente |
| 409 | sesion activa detectada en login |

## Notas

- No hay Swagger/OpenAPI en el codigo actual.
- La mayoria de payloads se modelan con DTOs simples o tipos inline en controllers.

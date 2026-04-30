# Rutas y layouts

## Rutas publicas

- `/`
- `/login`
- `/forgot-password`
- `/unauthorized`

## Layout por tenant

`app/[tenant]/layout.tsx`:

- exige sesion autenticada
- carga perfil si falta
- carga menu y permisos
- bloquea render hasta tener permisos
- aplica sidebar responsive
- contiene edicion de perfil y password

## Rutas tenant detectadas

- `/{tenant}/dashboard`
- `/{tenant}/configuracion`
- `/{tenant}/configuracion/menu`
- `/{tenant}/config/terminals`
- `/{tenant}/usuarios`
- `/{tenant}/roles`
- `/{tenant}/customers`
- `/{tenant}/inventory/products`
- `/{tenant}/inventory/purchases`
- `/{tenant}/inventory/suppliers`
- `/{tenant}/inventory/taxes`
- `/{tenant}/inventory/units`
- `/{tenant}/orders`
- `/{tenant}/purchases`
- `/{tenant}/suppliers`
- `/{tenant}/pos`
- `/{tenant}/pos/select-context`

## Observaciones

- Existen rutas duplicadas o heredadas para compras/proveedores fuera de `inventory/`.
- `dashboard` actual es informativo, no analitico.

# Flujo POS

## Secuencia

1. Login exitoso.
2. Frontend redirige a `/{tenant}/pos/select-context`.
3. `GET /api/auth/context` devuelve tenants/sucursales/terminales disponibles.
4. `POST /api/pos/session` crea `pos_user_sessions`.
5. El estado POS se guarda en Redux y `localStorage`.
6. `useRequirePosSession()` protege `/{tenant}/pos`.
7. La pantalla POS consume:
   - productos
   - clientes
   - impuestos
8. Al cobrar, el frontend llama `POST /api/sales`.

## Datos usados por POS

- tenant
- branch
- terminal
- posSessionId
- customerId
- items
- paymentMethods

## Comportamiento responsive

- Desktop: carrito lateral fijo
- Mobile/tablet: drawer inferior
- Boton flotante cuando el carrito esta cerrado

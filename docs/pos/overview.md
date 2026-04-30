# POS overview

## Componentes reales

- Selector de contexto POS
- Sesion POS por usuario
- Pantalla de venta
- Carrito responsive
- Integracion con ventas, clientes, productos e impuestos

## Dependencias backend

- `GET /api/auth/context`
- `POST /api/pos/session`
- `GET /api/pos/session/current`
- `POST /api/sales`
- `GET /api/products`
- `GET /api/customers`
- `GET /api/taxes`

## Estados observados

- contexto no seleccionado
- catalogo cargando
- carrito vacio
- venta en borrador
- cobro en proceso

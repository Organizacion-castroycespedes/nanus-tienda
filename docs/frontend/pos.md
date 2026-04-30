# Frontend POS

## Pantallas

- `/{tenant}/pos/select-context`
- `/{tenant}/pos`

## Selector de contexto

- carga `GET /api/auth/context`
- filtra tenant activo del usuario
- autoselecciona sucursal o terminal si solo existe una opcion
- crea sesion con `POST /api/pos/session`

## Pantalla POS

`modules/pos/components/PosScreen.tsx`:

- busca productos, clientes e impuestos
- filtra por stock disponible/bajo/sin stock
- arma carrito con cantidades y precios
- calcula impuestos incluidos por item
- soporta pago en efectivo, tarjeta y transferencia
- permite venta `CASH` o `CREDIT` segun cobertura de pagos

## Responsive UX

- Desktop: carrito lateral fijo
- Mobile: drawer bottom sheet
- Boton flotante para reabrir carrito

## Errores comunes gestionados en UI

- sin stock
- metodos de pago invalidos
- cliente faltante
- catalogo POS no cargado
- sesion POS ausente

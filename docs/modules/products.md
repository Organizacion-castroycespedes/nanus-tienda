# Modulo products

## Proposito

Administra catalogo de productos y su visibilidad operativa.

## Endpoints

- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

## Relaciones

- unidad obligatoria
- impuesto opcional
- stock derivado desde `stock_movements`

## UI

- pagina `/{tenant}/inventory/products`
- formulario crear/editar
- ajuste manual de stock separado

## Validaciones

- tenant obligatorio
- SKU controlado por backend/service

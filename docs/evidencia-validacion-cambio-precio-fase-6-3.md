# Evidencia validacion cambio de precio - Fase 6.3

## Decision final

FASE 6.3 APROBADA.

## Ambiente usado

- Fecha de prueba: 2026-06-01.
- DB local/QA: `localhost:5432/manus_tienda_prd`.
- Confirmacion: copia local de PRD, no PRD real.
- PostgreSQL: `16.12`.
- API local: `http://localhost:4022/api`.
- Web local: `http://localhost:3001`.
- Navegador de prueba UI: Chrome headless local por Chrome DevTools Protocol.
- Tokens/credenciales: usados solo localmente, no expuestos.

## Producto probado

- Producto: `Huevos`.
- Product ID: `30000000-0000-0000-0000-000000000005`.
- Tenant ID: `00000000-0000-0000-0000-000000000001`.
- SKU: `PROD-HUEVOS-001`.

## Flujo UI

Se valido desde UI real:

- Login local exitoso.
- Navegacion por menu: `Inventory` -> `Inventory / Productos`.
- Busqueda de producto `Huevos`.
- Apertura de `Cambiar precio`.
- Validacion de motivo corto: UI muestra regla de minimo 5 caracteres.
- Validacion de precio negativo: UI bloquea el envio por `input[type=number]` con `min=0`.
- Cambio valido aplicado:
  - Precio anterior: `18037`.
  - Precio nuevo: `18074`.
  - Motivo: `QA FE-6.3 UI cambio precio local`.
- UI mostro confirmacion `Precio actualizado`.
- Historial mostro el registro nuevo.
- Listado refresco y mostro `$ 18.074`.
- `ProductForm` en modo editar reflejo `price = 18074`.

## Validacion API

Tambien se valido por API local:

- `POST /api/products/:id/change-price` valido: `201`.
- Motivo corto: `400`.
- Precio negativo: `400`.
- Producto inexistente: `404`.
- `GET /api/products/:id`: `200`, precio actualizado.
- `GET /api/products/:id/price-history`: `200`, historial consultable.
- `GET /api/inventory/products`: `200`, producto aparece con precio actualizado.

Payload sanitizado:

```json
{
  "newPrice": 18074,
  "reason": "QA FE-6.3 UI cambio precio local"
}
```

## Queries DB usadas

```sql
SELECT id, tenant_id, name, sku, price
FROM products
WHERE id = '30000000-0000-0000-0000-000000000005';
```

```sql
SELECT previous_price, new_price, reason, status, changed_by, valid_from, created_at
FROM product_price_history
WHERE product_id = '30000000-0000-0000-0000-000000000005'
ORDER BY created_at DESC
LIMIT 3;
```

```sql
SELECT count(*), COALESCE(sum(price), 0), COALESCE(sum(subtotal), 0)
FROM sale_items
WHERE product_id = '30000000-0000-0000-0000-000000000005';
```

```sql
SELECT count(*), COALESCE(sum(price), 0), COALESCE(sum(subtotal), 0)
FROM order_items
WHERE product_id = '30000000-0000-0000-0000-000000000005';
```

## Resultado DB

`products.price` quedo en `18074.00`.

Ultimo historial:

- `previous_price`: `18037`.
- `new_price`: `18074`.
- `reason`: `QA FE-6.3 UI cambio precio local`.
- `status`: `APPLIED`.
- `changed_by`: presente.
- `valid_from`: presente.
- `created_at`: presente.

Historial previo conservado:

- `previous_price`: `18000`.
- `new_price`: `18037`.
- `reason`: `QA FE-6.3 cambio precio local`.
- `status`: `APPLIED`.

## Ventas historicas y pedidos

`sale_items` para el producto:

- Conteo: `14`.
- Suma `price`: `223040.00`.
- Suma `subtotal`: `281400.00`.
- Resultado: no cambio durante el flujo.

`order_items` para el producto:

- Conteo: `5`.
- Suma `price`: `57679.99`.
- Suma `subtotal`: `159399.97`.
- Resultado: no cambio durante el flujo.

## Compatibilidad

- `GET /api/products/:id` devuelve precio actualizado.
- `GET /api/inventory/products` devuelve precio actualizado.
- Crear/editar producto no se modifico en esta fase.
- No se tocaron POS, Orders, compras, `inventory_create_sale_v2`, SQL, `backend-reporteria/` ni frontend fuera del flujo ya implementado.

## Bugs encontrados/corregidos

- No se modifico codigo funcional.
- No se corrigieron bugs en `api/` ni `web/`.
- Hubo ajustes solo en el script local de automatizacion UI para navegar por SPA sin recargar sesion.

## Cleanup

- No se elimino el historial porque es la evidencia funcional esperada.
- DB local queda con `Huevos.price = 18074.00`.
- No se tocaron datos remotos ni PRD real.

## Riesgos vivos

- `ProductForm` aun permite editar `price` directamente por compatibilidad. La UI muestra ayuda para usar `Cambiar precio`, pero una fase posterior debe decidir si bloquea la edicion directa.
- No existe suite frontend automatizada formal; la prueba UI fue manual automatizada local con navegador headless.

## Proximos pasos

- Pasar a PricingService base.
- Definir politica final para bloquear o auditar edicion directa de `price` desde `ProductForm`.

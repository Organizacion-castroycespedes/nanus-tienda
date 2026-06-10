# Evidencia frontend promotions admin fase 6.9.1

Fecha: 2026-06-02
Rama: `feat/frontend-promotions-admin-fase-6-9-1`

## Alcance

- Se creo pantalla minima y funcional en `web/app/[tenant]/inventory/promotions/page.tsx`.
- Se creo servicio frontend en `web/modules/pricing/services/promotions.service.ts`.
- Se agrego regla frontend para `MENU_KEYS.INVENTORY_PROMOTIONS`.
- Se agrego acceso rapido desde dashboard de Inventario.

## Contrato real usado

- `GET /api/pricing/promotions`
- `GET /api/pricing/promotions/:id`
- `POST /api/pricing/promotions`
- `PATCH /api/pricing/promotions/:id`
- `PATCH /api/pricing/promotions/:id/deactivate`

Nota de contrato: `POST /api/pricing/promotions` crea promociones activas. Si el formulario crea con `isActive=false`, el frontend crea y luego aplica `PATCH /api/pricing/promotions/:id` con `{ "isActive": false }`.

## Funcionalidad

- Listado con nombre, descuento, vigencia, priority, productos, sucursales y estado.
- Filtro por estado: activas, inactivas y todas.
- Modal para crear y editar.
- Inactivacion logica.
- Seleccion de productos con `productIds`.
- Seleccion opcional de sucursales con `branchIds`.
- Mensajes de exito y error.

## Validaciones UX

- `PERCENTAGE` entre 0 y 100.
- `FIXED_AMOUNT` mayor a 0.
- `SPECIAL_PRICE` mayor o igual a 0.
- `endsAt` mayor que `startsAt`.
- `priority` entero y `>= 0`.
- Al menos un producto requerido.
- La pantalla indica que menor `priority` gana.
- Si `branchIds` esta vacio, se indica que aplica a todas las sucursales permitidas.

## Validaciones ejecutadas

- OK: `cd web && npm run lint`
  - Resultado: pasa con warnings preexistentes de `react-hooks/exhaustive-deps` y `@next/next/no-img-element`.
- OK: `cd web && npm run build`
  - Resultado: compila y genera ruta `/[tenant]/inventory/promotions`.
  - Nota: muestra warnings preexistentes y aviso de Browserslist desactualizado.
- OK: `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`
  - Resultado: `valid: true`, `issues: []`.
- OK: `git diff --check`
  - Resultado: sin errores de whitespace.
  - Nota: muestra warnings de conversion LF -> CRLF en archivos modificados.

## No tocado

No se toco backend, SQL, `PricingService`, POS venta, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Riesgos

- El backend de promociones toma tenant desde JWT. La ruta frontend usa `tenant` de la URL para cargar productos y sucursales; para usuarios normales debe coincidir con el JWT.
- Si `listBranches` falla, el formulario permite dejar `branchIds` vacio para aplicar a todas las sucursales permitidas.

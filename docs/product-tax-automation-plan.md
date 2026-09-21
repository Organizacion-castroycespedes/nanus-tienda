# Plan de automatizacion fiscal de productos

## Estado

- Fase actual: FASE 1 - PLANEAR
- Rama base: `origin/develop` (`fe5a8f6`)
- Rama de trabajo: `feat/product-tax-automation`
- Worktree: `L:\Proyectos\sociedad\wt-product-tax-automation`
- Objetivo: usar el precio final como entrada principal y resolver neto/impuestos con el catalogo fiscal existente, conservando compatibilidad con POS y facturacion.

## Arquitectura encontrada

- Frontend: `web/modules/inventory/components/ProductForm.tsx` y `web/modules/inventory/services/product.service.ts`.
- API: `api/src/modules/inventory/controllers/product.controller.ts`, `services/product.service.ts`, `repositories/product.repository.ts` y `repositories/tax.repository.ts`.
- Fiscal: `taxes`, `product_taxes`, `product_tax_profiles`, `tax_rates` y catalogos `tax_types`, `tax_calculation_methods`, `tax_base_types`, `tax_product_categories`.
- Pricing/POS: `api/src/modules/pricing/pricing.service.ts` y `pricing.repository.ts`; endpoint `POST /pricing/preview-line`.
- Persistencia de calculo: `price`, `price_with_tax`, `price_without_tax`; snapshots de impuestos para orden/venta.
- SQL fiscal relevante: `V077`, `V078`, `V079`, `V080`, `V082` y `api/database/2026_09_19_product_tax_inclusion.sql`.

## Hallazgos de FASE 1

### Formulario

- El formulario actual permite `price`, `priceWithoutTax`, `taxes`, orden y `isIncluded`.
- Tambien expone perfil fiscal, grado alcoholico, volumen y precio DANE.
- `priceWithoutTax` hoy es editable y se envia al API.
- La resolucion de licores hoy usa datos del perfil y la asignacion manual de impuestos; no se observa aun una preview fiscal de producto en el formulario.

### API y persistencia

- `POST /products` acepta precio, neto, precio con impuesto, impuestos y perfil fiscal.
- `PUT /products/:id` bloquea cambios directos de precio; el precio usa `POST /products/:id/change-price`.
- En create, si faltan precios derivados, `ProductService` usa `product.price` como ambos valores. No recalcula el neto desde el catalogo.
- `ProductService` valida existencia, tenant, orden, perfil de licor/ADV y persiste `product_taxes` y `product_tax_profiles` en transaccion.
- El backend valida los IDs de impuestos recibidos, pero no resuelve automaticamente impuestos por categoria/perfil.

### Motor fiscal/pricing

- `PricingService` calcula IVA incluido, impuestos porcentuales, fijos, ICL y ADV con redondeo monetario.
- `PricingRepository` consulta tarifas vigentes mediante `fnc_list_product_taxes_for_pricing(..., p_as_of)` y perfil mediante `fnc_get_product_tax_profile`.
- `PricingService` usa el precio visible del producto y puede calcular preview de linea; no existe aun un endpoint separado para preview de alta/edicion con precio propuesto y perfil propuesto.
- Las reglas especiales de licores requieren `alcoholDegree`, `netVolumeMl` y, para ADV, `daneCertifiedRetailPrice`.

## Decisiones y limites

- No inventar tarifas, codigos DIAN, bases ni valores de licores.
- No eliminar columnas existentes ni romper el contrato de POS/facturacion.
- Backend sera fuente de verdad; frontend solo mostrara preview.
- La automatizacion debe reutilizar `PricingService` o extraer una ruta comun, evitando otro motor fiscal.
- Probar primero con productos/catalogo local existentes. No crear tarifas fiscales ficticias.
- No deploy, merge ni cambios en la rama base.

## Implementacion realizada

- Se agrego `calculateProductPrices` para el caso seguro de impuestos porcentuales incluidos.
- `ProductService.createProduct` calcula el neto desde el precio final cuando todos los impuestos son porcentuales.
- Los productos con impuestos no porcentuales conservan temporalmente los valores derivados entregados o el precio final. Esto evita aplicar una formula IVA simple a licores, pero no completa aun la automatizacion ICL/ADV.
- `ProductForm` muestra `priceWithoutTax` y `priceWithTax` como solo lectura y deja de enviarlos como valores autoritativos.
- No hubo cambios de BD.

## Tareas pendientes de auditoria

- Confirmar el modulo que registra `PricingService` y todos sus consumidores.
- Confirmar productos locales reales, tenant, impuestos asignados y perfiles de licor disponibles.
- Revisar contratos de factura/XML/PDF para asegurar la semantica de `price_without_tax`.
- Definir el contrato minimo de preview create/update sin cambiar aun los contratos existentes.

## Plan de implementacion

| Paso | Cambio | Archivos probables | Riesgo | Prueba |
|---|---|---|---|---|
| 1 | Crear resolver de preview fiscal para precio final y perfil existente | `api/src/modules/pricing/*`, `api/src/modules/inventory/*` | Alto | unit + API local |
| 2 | Recalcular neto/impuestos en create y en cambios fiscales autorizados | `api/src/modules/inventory/services/product.service.ts` | Alto | unit + persistencia |
| 3 | Mantener compatibilidad de `price`, `price_with_tax`, `price_without_tax` | repositorio/migracion solo si es necesario | Alto | regresion POS |
| 4 | Hacer neto readonly y mostrar preview en create/edit | `web/modules/inventory/components/ProductForm.tsx` | Medio | lint + manual |
| 5 | Resolver datos de licor desde catalogo y perfil existentes | pricing/fiscal repositories | Alto | producto local de licor |
| 6 | Cubrir create/update y consistencia `neto + impuestos = total` | specs API y pricing | Alto | suite local |
| 7 | Verificar POS, facturacion, PDF/XML y build | servicios/tests/docs | Alto | regresion existente |

## Que no se toca

- `.env`, certificados, tokens, credenciales y produccion.
- Rama `develop`, otros worktrees, despliegues y merge.
- Tarifas o codigos fiscales sin fuente existente.
- Historial de precios y snapshots historicos.

## Pruebas pendientes

- Productos locales sin impuesto, IVA porcentual, y licor real del catalogo.
- Precio final `119000` con IVA 19% si el catalogo local contiene esa tarifa.
- Cambio de precio y clasificacion fiscal en update.
- Tarifas vigentes/fuera de vigencia, faltantes y redondeo.
- API, POS, facturacion, PDF/XML y builds.

## Riesgos

- El contrato actual acepta campos derivados enviados por frontend.
- `PricingService` trabaja con producto persistido, no con una configuracion fiscal propuesta.

## Matriz de pruebas

| Caso | Resultado | Evidencia |
|---|---|---|
| IVA incluido 19%, total 119000 | VERIFICADO | `priceWithoutTax=100000`, `priceWithTax=119000` |
| Sin impuesto | VERIFICADO | neto y final quedan iguales |
| Impuesto especial | PARCIAL | se evita formula porcentual; ICL/ADV aun usa valores existentes |
| Unit tests backend relacionados | VERIFICADO | 65/65 en calculator, ProductService y PricingService |
| API build | VERIFICADO | `npm run build` |
| Frontend lint | VERIFICADO | `npx next lint --no-cache` sin warnings/errors |
| Producto local VAT 19% | VERIFICADO como preview | cerveza local `3500` produce neto `2941.18`; BD conserva historico `3500` |
| Producto local licor | VERIFICADO como catalogo, no como E2E | `WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML`, perfil `DISTILLED_LIQUOR`, 40 grados, 700 ml, ICL DIAN 32, ADV DIAN 36, IVA 5 |
| Crear/editar por API con base local | NO VERIFICADO | requiere autenticar y ejecutar contra el API construido desde este worktree |
| POS/factura/PDF/XML completos | NO VERIFICADO | no se hicieron mutaciones ni venta/factura de prueba |

## Estado de fase

- FASE 1: completada con evidencia local.
- FASE 2: parcial. Precio porcentual automatizado; resolver completo de licores y asignacion automatica de VAT ambiguo siguen pendientes.
- FASE 3: pruebas locales unitarias, build, lint y lectura de productos completadas; E2E de API/POS/facturacion pendiente.
- Estado final de esta iteracion: PARCIAL.
- Productos locales pueden tener migraciones parciales o tarifas ausentes; eso debe quedar como evidencia, no suplirse con datos inventados.

## Evidencia local inicial (solo lectura)

- Contenedor local activo: `manus-api`; consulta hecha contra su base configurada, sin mostrar credenciales.
- Hay productos activos reales de desarrollo, incluidos licores como `WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML`, `WHISKY BUCHANANS DE LUXE 1000` y `whisky johnnie walker red label botella 700ml`.
- Los perfiles locales tienen categoria `DISTILLED_LIQUOR`, grado `40.000`, volumen real en ml y precio DANE persistido.
- El catalogo local contiene `LIQUOR_CONSUMPTION` DIAN `32`, metodo `PER_ALCOHOL_DEGREE_VOLUME`, base `ALCOHOL_DEGREE_VOLUME` y tarifas vigentes 2026. La consulta amplia muestra mas de una tarifa para algunos impuestos; la seleccion correcta debe seguir categoria y vigencia de la funcion fiscal, no el primer registro.
- Se observan productos con valores derivados no uniformes. Ejemplo: `WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML` tiene `price=162800`, `price_with_tax=199124.05` y `price_without_tax=162800`. Esto confirma que hay que recalcular desde reglas y no copiar valores historicos sin validar.
- No se alteraron productos locales durante esta fase.

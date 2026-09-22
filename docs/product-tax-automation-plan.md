# Plan de automatizacion fiscal de productos

## Estado

- Fase actual: FASE 2 - IMPLEMENTAR
- Rama base: `origin/develop` (`fe5a8f6`)
- Rama de trabajo: `feat/product-tax-automation`
- Worktree: `L:\Proyectos\sociedad\wt-product-tax-automation`
- Objetivo: usar el precio final como entrada principal y resolver neto/impuestos con el catalogo fiscal existente, conservando compatibilidad con POS y facturacion.

## Arquitectura encontrada (Verificada)

- Frontend: `web/modules/inventory/components/ProductForm.tsx` ya incluye lógica para evitar calcular neto si hay impuestos no porcentuales.
- API: `product.service.ts` se salta el cálculo (usando fallback a valores ingresados) para impuestos no porcentuales (ICL, ADV). `product-price-calculator.ts` solo maneja porcentaje.
- Fiscal DB: Tablas y migraciones (`product_taxes.is_included`, `fnc_list_product_taxes_for_pricing`) están listas y funcionales. La función trae `fixed_amount`, `percentage_rate`, `base_quantity` basándose en el perfil (`tax_product_category_id`).
- Pricing/POS: `PricingService` contiene toda la lógica fiscal (ICL, ADV, IVA) pero depende de consultar productos ya guardados (`PricingProductSnapshot`).

## Decisiones y límites

- Backend será la única fuente de verdad; frontend solo mostrará preview.
- La automatización de licores (ICL/ADV) REUTILIZARÁ la lógica de `PricingService`. Para esto, se extraerá un motor puro sin estado o se creará un método `calculateProposedProductPrices` que arme un snapshot en memoria sin consultar base.
- No se duplicará la fórmula de `(lineFinal - consumoAmount) / (1 + percentageRate)` en `product-price-calculator.ts` ni en frontend, ya que `PricingService.calculateAlcoholBreakdown` ya la hace.
- No modificar esquema de base de datos.
- Probar con productos locales.

## Plan de implementación (Actualizado)

1. **Extraer Motor Fiscal (API):**
   - Refactorizar `PricingService.calculateLinePreview` (o los métodos que usa) para que puedan aceptar un "snapshot propuesto" que no venga necesariamente de la BD. O crear un nuevo servicio `FiscalPreviewService` que reutilice el cálculo exacto de PricingService pero enfocado en 1 unidad sin promociones.
   
2. **Endpoint de Preview Fiscal (API):**
   - Crear `POST /inventory/products/fiscal-preview` (o dentro de pricing) que tome precio final, categoría fiscal, grados y volumen, y devuelva la estructura de preview y el precio base.

3. **Recalcular en Creación/Actualización (API):**
   - En `product.service.ts`, en vez de saltarse los no-porcentuales, utilizar la lógica compartida (o el nuevo motor sin estado) para calcular `priceWithoutTax` (neto) exacto al crear un licor.
   
4. **Actualizar Frontend:**
   - Hacer que `fiscalPricePreview` de `ProductForm.tsx` llame al endpoint de preview en vez de hacerlo en cliente, para mostrar los verdaderos cálculos de ICL y ADV.
   - Dejar los campos `priceWithoutTax` bloqueados o auto-calculados por el backend.

5. **Pruebas y Documentación:**
   - Ejecutar pruebas con licor de 40 grados, 700ml para confirmar que ICL/ADV e IVA se desglosan correctamente de un precio de venta final.

## Why

El Home publico actual comunica la idea general de Manus POS, pero necesita mas impacto visual y mejor conexion con funcionalidades reales ya construidas en la version base `0.0.1`. El cambio debe mejorar la primera impresion comercial sin tocar dashboard interno, backend, permisos, SQL ni rutas operativas.

## What Changes

- Rediseniar exclusivamente la ruta raiz publica `http://localhost:3000/`.
- Usar el asset comercial `/images/home/manus-pos-hero-landing.png` en el hero principal.
- Usar imagenes reales de `/images/features/` en las cards de funcionalidades publicas.
- Usar imagenes reales de `/images/benefits/` en las cards de beneficios publicos.
- Usar imagenes reales de `/images/audience/` en las cards de `Para quien sirve`.
- Normalizar nombres de assets para evitar rutas publicas con espacios en el Home.
- Reemplazar las cards de `Como funciona` por el flujo visual `/images/home/flows/flujo-operacion-pos.png`.
- Cerrar la fase con QA manual PASS, validaciones tecnicas y evidencia documentada.
- Reforzar el mensaje de valor: ventas, inventario, caja, pedidos, reportes y operacion diaria para tiendas/minimarkets.
- Implementar o ajustar secciones publicas: hero, funcionalidades, beneficios, showcase visual, como funciona y CTA final.
- Mantener diseno responsive, copy en espanol y consistencia con branding Manus POS.
- Generar evidencia QA documental del cambio.
- No cambiar backend, SQL, permisos, guards, dashboard interno tenant, Electron, Capacitor, perifericos, facturacion electronica, CRM ni rutas internas.

## Capabilities

### New Capabilities
- `public-home-manus-pos`: Cubre la experiencia de landing publica de Manus POS, su estructura comercial, asset hero, copy, responsive y limites frente a rutas internas.

### Modified Capabilities
- None.

## Impact

- Frontend publico: `web/app/page.tsx` y componentes bajo `web/components/landing/`.
- Asset usado: `web/public/images/home/manus-pos-hero-landing.png`.
- Asset de flujo operativo: `web/public/images/home/flows/flujo-operacion-pos.png`.
- Assets de funcionalidades: `web/public/images/features/*.png`.
- Assets de beneficios: `web/public/images/benefits/*.png`.
- Assets de audiencia: `web/public/images/audience/*.png`.
- Logo publico usado en landing: `web/public/LogoManus.png.jpeg`.
- Documentacion QA: `docs/evidencia-qa-home-publico-manus-pos.md`.
- OpenSpec: `openspec/changes/redisenar-home-publico-manus-pos/`.
- Sin impacto en backend, base de datos, permisos, guards, contratos API ni dashboard interno `/:tenantId/dashboard`.

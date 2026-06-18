## Context

La ruta publica `web/app/page.tsx` ya renderiza un landing con componentes en `web/components/landing/`. El diseno actual cubre secciones basicas, pero el hero no usa el asset visual entregado y el copy todavia no aprovecha con fuerza los modulos reales ya disponibles en `v0.0.1`.

La ruta interna `web/app/[tenant]/dashboard/page.tsx` existe y usa componentes en `web/components/home/`. Ese dashboard queda fuera del alcance y no debe mezclarse con el Home publico.

## Goals / Non-Goals

**Goals:**

- Redisenar `http://localhost:3000/` como landing publico comercial.
- Usar `/images/home/manus-pos-hero-landing.png` en el hero.
- Comunicar claramente POS, inventario, caja, pedidos, compras, clientes, reportes y configuracion.
- Mantener responsive desktop/tablet/mobile.
- Mantener navegacion publica con anchors a funcionalidades, beneficios, como funciona y contacto.
- Crear evidencia QA del cambio.

**Non-Goals:**

- No modificar `/:tenantId/dashboard`.
- No modificar rutas internas tenant.
- No tocar backend, SQL, permisos, guards ni contratos API.
- No agregar dependencias.
- No activar Electron, Capacitor, perifericos, facturacion electronica ni CRM.

## Decisions

1. Mantener la composicion existente de `web/app/page.tsx`.
   - Razon: ya separa landing publico de dashboard interno.
   - Alternativa descartada: crear una nueva ruta o layout publico; agrega alcance innecesario.

2. Usar el asset hero como imagen full-bleed de primera vista.
   - Razon: el asset ya comunica visualmente producto, dispositivos y beneficios.
   - Alternativa descartada: seguir usando mockups construidos en JSX; se ve menos comercial y no usa el asset solicitado.

3. Ajustar solo componentes `web/components/landing/*`.
   - Razon: preserva fronteras y evita tocar `web/components/home/*`, que alimenta el dashboard interno.
   - Alternativa descartada: refactor compartido de componentes entre landing/dashboard; riesgo de mezclar UX publica e interna.

4. Usar imagenes dedicadas de `web/public/images/features/` en las cards de funcionalidades.
   - Razon: los assets ya existen, elevan el impacto comercial y conectan cada modulo con una referencia visual concreta.
   - Alternativa descartada: mantener cards solo con iconos; comunica menos producto real.

5. Usar una imagen unica para explicar `Como funciona`.
   - Razon: el flujo generado resume configuracion, productos, POS, caja, inventario y reportes con mas claridad visual que cinco cards simples.
   - Alternativa descartada: mantener las cards paso a paso como elemento principal; duplican contenido y compiten con el asset.

6. Usar imagenes dedicadas de `web/public/images/benefits/` en las cards de beneficios.
   - Razon: los beneficios dejan de depender de iconos simples y ganan una lectura mas comercial.
   - Alternativa descartada: mantener `lucide-react` como visual principal en beneficios; queda menos diferenciador frente a funcionalidades.

7. Usar imagenes dedicadas de `web/public/images/audience/` en las cards de `Para quien sirve`.
   - Razon: cada tipo de negocio queda representado con un contexto visual moderno y facil de reconocer.
   - Alternativa descartada: mantener una grilla de iconos; se ve basica frente al resto del landing.

8. Cerrar la fase sin ampliar alcance funcional.
   - Razon: QA manual ya fue aprobado por el usuario y el cierre debe consolidar evidencia, validaciones y diff.
   - Alternativa descartada: tocar rutas internas o backend durante el cierre; aumenta riesgo y no pertenece al Home publico.

## Risks / Trade-offs

- [Risk] El asset contiene una composicion de landing completa y puede duplicar texto si se muestra entero. Mitigacion: usarlo como visual hero con overlay y foco comercial propio.
- [Risk] Warnings existentes de lint por hooks/img pueden permanecer. Mitigacion: usar `next/image` para el asset nuevo y reportar warnings no relacionados.
- [Risk] Rutas con espacios en nombres de imagen pueden romper o ensuciar URLs. Mitigacion: normalizar `caja-finanzas.png` y usar rutas absolutas sin espacios.
- [Risk] Nombres de assets de beneficios pueden quedar inconsistentes. Mitigacion: normalizar `menos-errores.png` y usar rutas kebab-case ASCII.
- [Risk] Imagenes de audiencia con nombres generados pueden ser dificiles de mantener. Mitigacion: usar nombres finales ASCII/kebab-case en `web/public/images/audience/`.
- [Risk] El texto dentro del flujo puede verse pequeno en mobile. Mitigacion: usar imagen sin recorte, `object-contain` y contenedor con scroll horizontal.
- [Risk] El cambio visual puede afectar mobile si el hero es alto. Mitigacion: usar constraints responsive, `min-h` controlado y anchors claros.
- [Risk] Cualquier cambio accidental en dashboard interno mezclaria alcance. Mitigacion: no editar `web/app/[tenant]/dashboard/*` ni `web/components/home/*`; revisar `git diff`.

## Migration Plan

No hay migracion. El cambio se despliega como frontend estatico/Next build.

Rollback: revertir archivos de `web/components/landing/*`, `web/app/page.tsx` si cambia, evidencia docs y artefactos OpenSpec de este change.

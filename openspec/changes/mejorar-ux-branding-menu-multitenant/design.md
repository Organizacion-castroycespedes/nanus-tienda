## Context

La configuracion de tenant ya expone branding y el layout ya aplica variables CSS derivadas de Redux. El problema esta en la experiencia de edicion y en la robustez visual: los colores no se leen claramente, la vista previa es limitada y los tokens actuales no cubren todos los estados de menu con contraste consistente.

## Goals / Non-Goals

**Goals:**
- Mostrar colores cargados del tenant con swatch y hex editable.
- Validar hex antes de guardar y tolerar valores invalidos desde backend.
- Reusar helpers de tema existentes y extenderlos con nombres requeridos por el cambio.
- Aplicar tokens derivados del tenant activo a menu principal, submenus, hover y focus.
- Mantener el preview basado en estado local antes de guardar.
- Mantener el layout real basado en branding persistido en Redux despues de guardar.

**Non-Goals:**
- No cambiar contratos API ni base de datos.
- No tocar permisos, guards, autenticacion ni modulos operativos fuera de configuracion/layout.
- No introducir nueva libreria visual.
- No resolver almacenamiento seguro de refresh token ni otros riesgos de seguridad fuera del alcance.

## Decisions

1. Centralizar normalizacion y contraste en `web/src/lib/theme/colors.ts`.
   - Razon: ya contiene conversion RGB/HSL, contraste y mezcla de colores.
   - Alternativa considerada: helpers locales en la pagina. Se descarta porque duplicaria reglas y aumentaria riesgo de diferencias entre preview y layout.

2. Exponer `buildTenantThemeTokens` como alias estable de `buildTenantTheme`.
   - Razon: cumple el contrato solicitado y conserva compatibilidad con llamadas existentes.
   - Alternativa considerada: renombrar el helper existente. Se descarta para minimizar cambios.

3. Crear `getMenuItemStateStyles(themeTokens, state)` para estilos inline de estados.
   - Razon: el layout necesita estados legibles por tenant y el preview debe usar la misma logica.
   - Alternativa considerada: solo clases Tailwind. Se descarta porque los colores vienen en runtime desde tenant.

4. Usar componente reusable `ColorField` para captura de hex.
   - Razon: el campo de color es reusable para futuras pantallas y debe seguir el patron visual de `Input.tsx`.
   - Alternativa considerada: modificar `Input`. Se descarta porque impactaria campos de toda la app.

5. Refinar la implementacion con el design-system existente.
   - Razon: el preview inicial funcionaba, pero visualmente competia con el layout por usar demasiado color tenant.
   - Decision: extraer `ColorField` a `web/components/design-system/ColorField.tsx` porque es reusable, y extraer `BrandingThemePreview` como componente local de configuracion porque representa esta pantalla.
   - Decision: `buildTenantThemeTokens` genera `primarySoftBg`, `primaryBorder`, `secondarySoftBg`, `secondaryBorder`, `appBackground` y `menu.*` para usar branding como acento sobre superficies `slate`/white del sistema.

## Risks / Trade-offs

- [Riesgo] Algunos colores de tenant pueden ser demasiado claros, neon o invalidos -> Mitigacion: normalizar, fallback y calcular texto legible.
- [Riesgo] El preview podria diferir del layout real -> Mitigacion: ambos usan los mismos helpers de tokens.
- [Riesgo] Estado stale al cambiar tenant super admin -> Mitigacion: reset inmediato a defaults seguros antes de cargar y aplicar respuesta solo si el efecto sigue activo.
- [Riesgo] Sin test runner web configurado -> Mitigacion: agregar pruebas Node focalizadas y ejecutarlas con el `tsx` disponible en el workspace cuando sea posible.

## Migration Plan

1. Agregar helpers de color/tema y pruebas.
2. Actualizar configuracion Branding con `ColorField`, validacion y preview.
3. Actualizar layout/menu para usar tokens de estado.
4. Agregar evidencia QA.
5. Validar OpenSpec, lint, build y checks disponibles.

Rollback: revertir cambios frontend y docs de este change. No hay migracion de datos.

## Open Questions

- Ninguna bloqueante. Si backend devuelve colores en formato distinto a hex, se usan defaults seguros y se muestra estado invalido al editar.

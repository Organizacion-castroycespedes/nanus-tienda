## Why

La pestana Branding en configuracion carga colores del tenant, pero los campos `type=color` se ven como inputs vacios o con poco contexto. Esto dificulta validar visualmente el branding antes de guardar y deja el menu lateral con estados activos, hover y submenus que pueden perder contraste segun colores de cada tenant.

## What Changes

- Mejorar los campos de color para mostrar label, swatch visible, valor hexadecimal editable y estado invalido por campo.
- Validar y normalizar colores hexadecimales con fallbacks seguros para valores vacios, null, undefined o invalidos.
- Mejorar la vista previa de branding en tiempo real con empresa real, logo, tipografia, fondo, texto, boton primario, acento secundario y mini menu con estados normal/activo/submenu.
- Derivar tokens visuales dinamicos desde el branding del tenant activo para menu lateral, submenus, hover, focus y opcion seleccionada.
- Evitar estado stale entre tenants al cargar configuracion y al aplicar branding persistido.
- Agregar pruebas focalizadas para helpers de color, tokens de tema y comportamiento basico multi-tenant.

## Capabilities

### New Capabilities
- `tenant-branding-menu-ux`: Cubre edicion visual de branding por tenant, validacion de colores, preview en tiempo real y aplicacion accesible al menu.

### Modified Capabilities
- None.

## Impact

- Frontend: `web/app/[tenant]/configuracion/page.tsx`, `web/app/[tenant]/layout.tsx`, `web/src/lib/theme/*`, tests focalizados.
- Documentacion QA: `docs/evidencia-qa-branding-menu-multitenant-ux.md`.
- No cambia contratos API, autenticacion, permisos/guards, SQL, POS, Orders, Finance, Inventory ni CRM.

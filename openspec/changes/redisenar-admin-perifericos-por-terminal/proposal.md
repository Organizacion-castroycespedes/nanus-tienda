## Why

`/admin/peripherals` nacio como consola tecnica para un mundo MOCK. Ahora ya existe hardware real, `terminals` es la identidad canonica y `pos_terminals` quedo como perfil/extencion periferica. La pantalla actual mezcla laboratorio, runtime del Agent y configuracion persistente, y ya no representa bien el flujo operativo real.

## What Changes

- Redisenar `/[tenant]/admin/peripherals` como administracion operativa centrada en `terminals.id`.
- Agregar deep-link desde `/[tenant]/config/terminals` para abrir la configuracion de perifericos de una terminal real.
- Mantener `pos_terminals` como perfil/extencion periferica de la terminal operativa, no como otra terminal comercial.
- Mostrar el `Agent` local como bloque tecnico resumido y separar herramientas MOCK/QA del flujo principal.
- Agrupar la administracion en bloques de `Impresora`, `Scanner`, `Balanza` y `Cajon`, con impresion real como foco de esta fase.
- Hacer que discovery solo descubra dispositivos y que la asociacion sea una accion explicita contra la API oficial de configuracion.
- Mantener `local-terminal` como identidad tecnica/legacy del Agent, nunca como terminal comercial principal.
- Exponer estados operativos claros para configurado, no configurado, detectado, no detectado y errores tecnicos.
- **BREAKING UX**: retirar el foco principal de la vista tecnica/mock y priorizar el selector de terminal canonica.

## Capabilities

### New Capabilities
- `admin-peripherals-by-terminal`: pantalla de administracion operativa de perifericos por terminal canonica, con deep-link desde configuracion de terminales, selector de terminal, discovery, asociacion explicita y estados operativos.

### Modified Capabilities
- Ninguna. Esta iniciativa agrega una nueva capacidad de UX y reorganiza la presentacion, pero no cambia aun contratos de negocio persistidos ni reglas de hardware.

## Impact

- `web/app/[tenant]/config/terminals/*`: agregar la accion `Configurar perifericos`.
- `web/app/[tenant]/admin/peripherals/*` y `web/domains/peripherals/*`: rediseno de la pantalla, selector canonico, resumen de terminal, bloques de perifercos y seccion tecnica/QA.
- `web/lib/route-permissions.ts` y `web/lib/permissions.ts`: solo si el flujo autorizado actual necesita un ajuste minimo para el rediseño.
- `web/modules/terminals/*` y `web/domains/terminals/*`: reutilizacion de terminales canonicas y filtros por tenant/sucursal.
- `openspec/changes/redisenar-admin-perifericos-por-terminal/*`: artefactos del cambio.
- Dependencia conceptual: `alinear-terminales-operativas-perifericos-pos`.
- Fuera de alcance: scanner HID real, balanza real, cajon real, cambios DB, migraciones, Electron y packaging adicional.

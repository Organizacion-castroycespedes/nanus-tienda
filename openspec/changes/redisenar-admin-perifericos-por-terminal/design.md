## Context

`/[tenant]/admin/peripherals` nacio como consola tecnica para un entorno MOCK. Hoy el sistema ya tiene terminales canonicas reales en `/config/terminals`, un Agent local por workstation, XP-80 USB certificada y XP-80 LAN certificada. La pantalla actual sigue mezclando identidad comercial, identidad tecnica del Agent, runtime local y herramientas de QA, y eso ya no encaja con el flujo operativo real.

Este cambio se apoya conceptualmente en `alinear-terminales-operativas-perifericos-pos`, que ya fijo la idea de `terminals.id` como identidad canonica y `pos_terminals` como perfil/extencion periferica. Esta mejora no reabre ese contrato; lo usa como base.

## Goals / Non-Goals

**Goals:**
- Hacer que `/admin/peripherals` trabaje alrededor de una terminal canonica real.
- Permitir deep-link desde `/config/terminals` sin usar `posTerminalId`.
- Separar configuracion persistente de terminal del registry runtime del Agent.
- Mantener XP-80 USB y XP-80 LAN como alternativas distintas.
- Mantener las herramientas MOCK/QA, pero fuera del flujo operativo principal.
- Reducir confusion entre `terminals.id`, `posTerminalId`, `agentTerminalCode` y `deviceId`.

**Non-Goals:**
- No implementar scanner HID real.
- No implementar balanza real.
- No implementar cajon real.
- No cambiar esquema DB ni migraciones.
- No agregar Electron ni packaging adicional.
- No rehacer el bridge operativo certificado de TERM-001.

## Decisions

1. **Deep-link desde `config/terminals` hacia `admin/peripherals`.**
   - Elegimos la navegacion desde terminales canonicas porque el usuario ya piensa en una terminal comercial real y no en un perfil tecnico.
   - Alternativa descartada: mantener `/admin/peripherals` como pantalla aislada. Eso obliga a duplicar mentalidad y escondia el contexto de negocio.

2. **Selector canonico dentro de `/admin/peripherals`.**
   - La pantalla debe poder cambiar de terminal sin salir, pero el selector debe listar solo terminales reales de negocio.
   - `local-terminal` no puede ser la opcion principal. Solo puede aparecer en detalles tecnicos o compatibilidad.

3. **Separar resumen operativo de detalles tecnicos.**
   - El usuario necesita ver primero codigo, nombre, sucursal y estado periferico.
   - `posTerminalId`, `agentTerminalCode`, `terminalId` del Agent y otros datos de puente van a un bloque tecnico colapsable.

4. **Reusar APIs existentes antes de inventar nuevas.**
   - `GET /api/terminals`, `GET /api/pos-terminals/resolve-current`, `GET /api/pos-terminals/:id/peripherals`, `PUT /api/pos-terminals/:id/peripherals`, `GET /devices`, `POST /devices/discover` y `POST /printer/test-print` deben cubrir el flujo P0.
   - Solo si la UI no puede expresar bien el estado con esos datos, se evaluaran metadatos adicionales. No se agregan APIs solo por ornamento visual.

5. **Persistencia y runtime quedan bien separados.**
   - `Agent device registry` es inventario runtime/local.
   - `pos_terminal_peripheral_settings` es configuracion de negocio.
   - Descubrir nunca debe guardar.
   - Asociar nunca debe asumir que discovery ya persistio algo.

6. **Impresora como foco funcional.**
   - La impresora es el bloque operativo principal de esta fase.
   - Scanner, balanza y cajon quedan visibles solo como configuracion existente o bloque de futuro, sin nuevo comportamiento fisico.

7. **Herramientas MOCK/QA colapsadas por defecto.**
   - `scanner simulator`, `mock print`, preview conceptual ESC/POS y websocket events deben salir del flujo principal.
   - Si se conservan, van a una seccion tecnica/QA con visualizacion colapsada por defecto.

8. **Permisos conservados con ajuste minimo si hace falta.**
   - La regla de acceso no se amplia por accidente.
   - Si existe diferencia entre `CONFIG_TERMINALS.read`, `peripherals.manage`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`, se corrige solo lo minimo para que el flujo autorizado existente siga funcionando.

## Risks / Trade-offs

- [Risk] El usuario siga viendo demasiados conceptos tecnicos. → Mitigation: esconderlos en un panel tecnico y mostrar solo lo comercial primero.
- [Risk] La misma XP-80 pueda verse como USB y NETWORK y genere dudas. → Mitigation: mostrar ambas como opciones separadas y no deduplicar.
- [Risk] Sin nuevas APIs, algunos estados de detalle pueden quedar limitados. → Mitigation: usar el contrato actual y documentar deuda futura de metadatos de Agent.
- [Risk] `local-terminal` siga apareciendo por compatibilidad y confunda. → Mitigation: tratarlo solo como compatibilidad tecnica y nunca como terminal comercial principal.
- [Risk] La separacion entre runtime del Agent y persistencia de terminal puede romperse en la UI. → Mitigation: etiquetar claramente cada accion como descubrir, asociar o guardar.

## Migration Plan

1. Ajustar la navegacion desde `/config/terminals` para abrir `/admin/peripherals` con `terminalId`.
2. Redisenar la pantalla para que el primer estado sea terminal canonica seleccionada.
3. Reubicar debugging y MOCK en seccion tecnica colapsada.
4. Validar que la impresora siga soportando XP-80 USB y XP-80 LAN como opciones distintas.
5. Mantener `TERM-001` sin cambios de configuracion persistida durante el desarrollo.
6. Probar manualmente el flujo con `TERM-001` y confirmar que USB sigue persistida mientras LAN aparece como alternativa.

Rollback:
- Revertir cambios de UI y enlazado de navegacion.
- No requiere migration DB porque no se cambia persistencia.

## Open Questions

- ¿`ADMIN` debe poder editar perifericos o solo verlos? La regla actual parece mixta y debe revisarse con cuidado.
- ¿Hace falta un endpoint de estado enriquecido del Agent o el contrato actual basta para P0?
- ¿El bloque tecnico debe mostrar `agentInstallationId`, `platform` y `architecture` si ya estan disponibles en el runtime, o eso queda para una mejora posterior?

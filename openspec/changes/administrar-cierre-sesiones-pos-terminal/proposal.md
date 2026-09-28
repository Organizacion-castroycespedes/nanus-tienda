## Why

La sesión POS de una terminal puede permanecer activa después de que el operador abandona la interfaz, bloqueando una sustitución administrativa segura del computador físico. Manus necesita una operación excepcional, explícita y auditada para consultar y cerrar una sola sesión POS sin cerrar cajas, alterar ventas o afectar otras terminales.

## What Changes

- Añadir consulta administrativa tenant-safe de sesiones POS activas para una terminal lógica y sucursal concretas.
- Añadir cierre administrativo individual con motivo validado, controles de caja y operaciones pendientes, bloqueo de concurrencia y auditoría.
- Rechazar cierres cuando la sesión cambió, tiene caja abierta, operaciones pendientes o pertenece a otro tenant, sucursal o terminal.
- Añadir gestión visual en Configuración > Terminales con confirmación del Design System, estados loading y errores accionables.
- Mantener separado el cierre normal del usuario del cierre administrativo excepcional.
- Impedir cierre masivo, invalidación de `auth_sessions`, cambios de Devices, bindings, ventas, pagos o cajas.

## Capabilities

### New Capabilities

- `pos-session-administration`: Consulta y cierre administrativo seguro de sesiones POS activas por terminal.

### Modified Capabilities

-

## Impact

- API NestJS: módulo `pos-user-sessions`, repositorio, servicio, controller, DTO y pruebas.
- Web Next.js: Configuración de Terminales, servicios y componentes del panel de terminales.
- Auditoría existente `auditoria_eventos`.
- Tablas existentes `pos_user_sessions`, `auth_sessions`, `terminals`, `tenant_branches`, `cash_sessions`, `cash_registers`, `sales` y `payments`.
- No requiere migración prevista ni cambios en Electron, Peripheral Agent, Installer o Devices.

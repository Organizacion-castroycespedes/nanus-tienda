# Electron tenant, branch and terminal context

Fecha: 2026-06-20  
OpenSpec change: `configurar-electron-tenant-sucursal-terminal`

## Objetivo

Preparar una configuracion local minima para que el shell Electron online pueda resolver contexto inicial de tenant, sucursal y terminal sin cambiar backend, SQL, permisos ni logica operativa.

## Alcance

- Resolver `MANUS_WEB_URL`.
- Resolver `MANUS_START_PATH`.
- Resolver `MANUS_TENANT_ID`.
- Leer `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID` como contexto local reservado.
- Construir la URL inicial que Electron carga.
- Mantener Electron como contenedor online de la web existente.
- Agregar tests unitarios del helper de configuracion.

## Fuera de alcance

- Backend.
- SQL/migraciones.
- Permisos reales.
- Cambios POS.
- Cambios caja.
- Cambios pedidos.
- Cambios clientes.
- Cambios facturacion.
- Crear sesion POS.
- Abrir caja automaticamente.
- Offline.
- Sincronizacion.
- Perifericos.
- Instaladores.
- Auto-update.

## Variables de entorno

| Variable | Uso | Comportamiento |
| --- | --- | --- |
| `MANUS_WEB_URL` | URL base web | Default `http://localhost:3000`. |
| `MANUS_START_PATH` | Ruta inicial explicita | Debe empezar con un solo `/`; tiene prioridad sobre tenant. |
| `MANUS_TENANT_ID` | Tenant inicial opcional | Si no hay `MANUS_START_PATH`, construye `/<tenantId>`. |
| `MANUS_BRANCH_ID` | Sucursal local reservada | Se lee, pero no altera URL ni llama backend. |
| `MANUS_TERMINAL_ID` | Terminal local reservada | Se lee, pero no altera URL ni crea sesion POS. |

## Resolucion de URL

Reglas:

1. Si `MANUS_START_PATH` existe, Electron carga `MANUS_WEB_URL + MANUS_START_PATH`.
2. Si no hay `MANUS_START_PATH` y existe `MANUS_TENANT_ID`, Electron carga `MANUS_WEB_URL + /<tenantId>`.
3. Si no hay contexto, Electron mantiene el default actual y carga `MANUS_WEB_URL`.
4. Si `MANUS_START_PATH` no empieza con un solo `/`, la configuracion falla con error explicito.

Ejemplos:

| Variables | URL inicial |
| --- | --- |
| ninguna | `http://localhost:3000/` |
| `MANUS_WEB_URL=https://www.apptiendamanus.space` | `https://www.apptiendamanus.space/` |
| `MANUS_START_PATH=/login` | `http://localhost:3000/login` |
| `MANUS_TENANT_ID=tenant-demo` | `http://localhost:3000/tenant-demo` |
| `MANUS_TENANT_ID=tenant-demo`, `MANUS_START_PATH=/login` | `http://localhost:3000/login` |

## Relacion con clientes Tipo B y Tipo D

Tipo B:

- Electron puede usar contexto local para orientar la instalacion desktop.
- La web/API siguen validando autenticacion, permisos, tenant y sesiones.

Tipo D:

- Web sigue siendo el canal de administracion.
- Electron queda preparado para caja/POS online en terminal fisica.
- Sucursal y terminal quedan listos como conceptos locales, no como contrato backend nuevo.

## Decision sobre tenant/sucursal/terminal

Tenant puede definir ruta inicial simple cuando no hay `MANUS_START_PATH`.

Sucursal y terminal se leen pero no se usan para construir la URL. Esto evita crear contratos implicitos por querystring o headers y evita sugerir que Electron puede abrir caja o crear sesion POS por si solo.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Configuracion local se interpreta como autorizacion | Documentar que backend/web siguen validando auth y permisos. |
| Tenant incorrecto abre ruta inexistente | Usar ruta inicial simple y validar en QA futura. |
| Branch/terminal parecen activos | Documentar que quedan reservados. |
| Start path externo o ambiguo | Rechazar paths que no empiezan con un solo `/`. |

## Proximas fases

1. Definir archivo local de configuracion si soporte lo necesita.
2. Definir pantalla o flujo de setup de terminal.
3. Validar tenant/sucursal/terminal contra API autenticada.
4. Validar POS/caja online con contexto.
5. Evaluar perifericos Windows.
6. Empaquetado Windows.

## Reservado para fases futuras

- Persistencia local segura de configuracion.
- Validacion backend de terminal.
- Contrato API para asociar instalacion Electron con terminal.
- Permisos especificos por terminal.
- Migraciones SQL si el modelo de terminal cambia.
- Auditoria de cambio de configuracion local.

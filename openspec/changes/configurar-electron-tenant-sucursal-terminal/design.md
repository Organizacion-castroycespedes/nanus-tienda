## Context

El shell Electron actual vive en `desktop/electron/` y carga `MANUS_WEB_URL` con default `http://localhost:3000`. La fase anterior valido que la ventana Electron abre Manus POS Web en `/login`.

Para clientes Tipo B y Tipo D se necesita preparar una configuracion local de instalacion que pueda apuntar a una ruta inicial y retener contexto de tenant, sucursal y terminal. Esa configuracion no debe crear sesiones POS, abrir caja ni saltarse permisos.

Discovery inicial:

| Item | Resultado |
| --- | --- |
| Rama | `feat/0.0.1/arquitectura-clientes-web-electron` |
| Worktree | Limpio |
| Ultimos commits | `9f84bc0`, `64d9e68` |
| Electron shell | `desktop/electron/main.ts`, `preload.ts`, `package.json`, `tsconfig.json`, `README.md` |

## Goals / Non-Goals

**Goals:**

- Resolver configuracion local de Electron desde variables de entorno.
- Construir URL inicial online con `MANUS_WEB_URL`, `MANUS_START_PATH` o `MANUS_TENANT_ID`.
- Leer `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID` como contexto local reservado.
- Mantener branch/terminal fuera de la URL por ahora.
- Agregar tests unitarios del helper.
- Mantener seguridad base Electron y preload sin APIs de negocio.

**Non-Goals:**

- No modificar backend.
- No modificar SQL/migraciones.
- No modificar permisos reales.
- No modificar POS, caja, pedidos, clientes ni facturacion.
- No crear sesion POS.
- No abrir caja automaticamente.
- No implementar offline ni sync.
- No integrar perifericos.
- No crear instaladores ni auto-update.

## Decisions

### 1. Config helper puro

Decision: crear `desktop/electron/config.ts` sin importaciones Electron.

Rationale: permite testear resolucion de configuracion sin abrir ventana, sin GUI y sin API.

Alternativa considerada: dejar todo en `main.ts`. Se descarta porque dificulta pruebas y mezcla arranque de Electron con reglas de configuracion.

### 2. `MANUS_START_PATH` tiene prioridad

Decision: si `MANUS_START_PATH` existe, define la ruta inicial.

Rationale: es la forma mas explicita para QA y soporte. Permite abrir `/login`, una ruta tenant o una ruta operativa documentada.

Alternativa considerada: tenant siempre gana. Se descarta porque impide forzar rutas especificas.

### 3. Start path invalido falla

Decision: `MANUS_START_PATH` debe empezar con `/`; si no, el helper lanza error.

Rationale: fallar temprano evita construir URLs ambiguas o externas. La decision queda documentada y testeada.

Alternativa considerada: normalizar agregando `/`. Se descarta porque puede esconder configuracion defectuosa.

### 4. Tenant construye ruta inicial simple

Decision: si hay `MANUS_TENANT_ID` y no hay `MANUS_START_PATH`, la ruta inicial sera `/<tenantId>` usando encoding de path.

Rationale: no asume entrada directa al POS. Solo apunta al contexto tenant y deja que la web maneje auth/rutas/permisos.

Alternativa considerada: abrir `/<tenantId>/pos`. Se descarta porque no esta validado para todas las instalaciones y podria sugerir apertura operativa no autorizada.

### 5. Branch y terminal quedan reservados

Decision: `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID` se leen y documentan, pero no alteran la URL ni se envian por canal nuevo.

Rationale: prepara el modelo de instalacion sin cambiar contratos API ni comportamiento POS.

Alternativa considerada: ponerlos en querystring. Se descarta porque podria parecer contrato funcional nuevo y afectar seguridad/permisos.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| Soporte confunde contexto local con permisos | Documentar que la API/web siguen validando auth, permisos y sesion. |
| Tenant mal configurado abre ruta inexistente | Mantenerlo como ruta inicial simple y validar en web/QA futuro. |
| Start path invalido bloquea arranque | Fallo explicito y test cubierto; soporte corrige variable. |
| Branch/terminal parecen activos | Documentar que quedan reservados y no crean sesiones. |
| Drift entre config local y backend | No persistir ni sincronizar en esta fase. |

## Migration Plan

No hay migracion de datos.

Pasos:

1. Agregar helper `config.ts`.
2. Agregar tests `config.spec.ts`.
3. Ajustar `main.ts` para usar `initialUrl`.
4. Actualizar README y arquitectura.
5. Ejecutar `npm test`, `npm run typecheck`, OpenSpec strict y `git diff --check`.

Rollback: revertir cambios en `desktop/electron/`, docs y OpenSpec. No hay backend, SQL ni permisos que revertir.

## Open Questions

- Si fase futura guardara config local en archivo, instalador o UI de setup.
- Si tenant/sucursal/terminal se validaran contra API antes de abrir ruta.
- Si una fase futura debe pasar branch/terminal a la web mediante API autenticada, query temporal o almacenamiento seguro.

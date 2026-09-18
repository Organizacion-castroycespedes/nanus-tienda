# Electron: inicio y reconexión

Manus POS continúa siendo un cliente online. La vista local solo evita la pantalla blanca durante inicio, pérdida de red o recuperación del renderer; no guarda ventas, caja, inventario ni facturación.

## Auditoría y estado final

| Componente | Estado | Evidencia |
|---|---|---|
| Pantalla local de inicio | IMPLEMENTADO | `desktop/electron/resources/connectivity/` |
| `did-fail-load` de main frame | IMPLEMENTADO | `desktop/electron/main.ts` filtra `isMainFrame` |
| Errores de red recuperables | IMPLEMENTADO | `desktop/electron/connectivity.ts` |
| Reconexión automática | IMPLEMENTADO | Backoff 2 s, 4 s, 8 s, 15 s, 30 s |
| Un solo timer de retry | IMPLEMENTADO | El controlador local cancela y reutiliza el timer |
| Reintentar ahora | IMPLEMENTADO | IPC `manusTerminal.retryConnection` |
| Última URL remota válida | IMPLEMENTADO | Se conserva solo en memoria tras `did-finish-load` |
| Health real | IMPLEMENTADO | `net.fetch` desde el proceso principal, timeout de 5 s |
| Crash del renderer | IMPLEMENTADO | Recuperación limitada por `window-policy.ts` |
| Ventana no responsiva | PARCIAL | Se registra; no se clasifica como error de red |
| HTTP/auth 401, 403, 404 | IMPLEMENTADO | No se convierten en pantalla de reconexión |
| CSP local | IMPLEMENTADO | `connect-src 'none'`, sin CDN ni `unsafe-eval` |
| Tests | IMPLEMENTADO | `npm test`, 39/39 pass |

## Prueba manual Windows

1. Abrir Electron sin Internet: debe aparecer `Iniciando Manus POS` y luego `Sin conexión con el servicio`.
2. Conectar Internet: la vista debe pasar por `Reconectando` y `Conexión restablecida`.
3. Abrir sesión, entrar a `/pos`, desconectar Wi-Fi y comprobar que no aparece una ventana blanca.
4. Volver a conectar y comprobar que regresa a la última URL remota válida sin reiniciar Electron.

Los códigos técnicos y URLs quedan en logs del proceso principal; la UI no muestra DNS, stack traces ni tokens.

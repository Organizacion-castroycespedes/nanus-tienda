# Diseño

## Modelo único

El inventario físico local, configuración persistida y asignación de terminal
son capas separadas. Los estados `DISCOVERED`, `CONFIGURED`,
`CONFIGURED_AND_DETECTED`, `OFFLINE`, `NOT_DETECTED`, `TESTED` y `ERROR` no
se pueden colapsar.

Agent es fuente de verdad física (PnP, conexión, capacidades y lastSeen).
Backend conserva tenant, branch, terminal, perfil y asignación. El instalador
persiste mediante los contratos existentes; Manus POS los lee sin segunda
configuración.

## Seguridad y compatibilidad

Electron mantiene IPC explícito y loopback privado. Web mantiene su transporte
HTTP. No se agregan proxies genéricos ni endpoints inventados. REAL mode nunca
devuelve semillas MOCK.

## Descubrimiento

Windows combinará PnP USB y print queues con deduplicación conservadora.
Queue existente sin presencia física será `OFFLINE`/`NOT_DETECTED`. Scanner
keyboard-wedge requiere validación por escaneo real, no `scanner/simulate`.

## Persistencia y asignación

Muchas impresoras pueden existir en inventario; una terminal mantiene una
impresora POS principal salvo contrato existente contrario. Agregar/editar,
probar y asignar son operaciones explícitas y reversibles.

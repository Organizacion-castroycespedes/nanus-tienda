## Why

### Fase 1B.9.1: Core tÃ©cnico y recorrido visual

El Core termina la instalaciÃ³n tÃ©cnica, el arranque y el health check del
servicio antes de iniciar el recorrido interactivo. `DISCOVER_DEVICES` y
`CONFIGURE_DEVICES` reciben `STEP_SKIPPED` explÃ­cito: eso no declara detecciÃ³n
ni prueba fÃ­sica exitosa. El WebView inicia despuÃ©s discovery, configuraciÃ³n,
reintentos y la opciÃ³n de continuar sin perifÃ©ricos opcionales. Un fallo de
perifÃ©rico no reinstala ni revierte el servicio sano. ROCHI, KG, autenticaciÃ³n
Agent y ventas `REAL` siguen fuera de esta fase.

Manus ya guarda el modelo de venta `UNIT`, `WEIGHT` y `BOTH`. El flujo de `/pos` conserva controles históricos de balanza MOCK, pero debe ocultarlos cuando la terminal no tiene configuración efectiva y no puede usar una lectura como evidencia comercial REAL. El driver ROCHI Windows ya fue validado de forma independiente; este cambio define el contrato comercial seguro para solicitar peso bajo demanda.

## What Changes

### Fase 2D — registro administrativo seguro

Esta fase agrega únicamente el registro administrativo de credenciales de instalación y la
vinculación tenant-aware entre terminal, instalación Agent y SCALE lógico. No emite secretos,
no autentica todavía al Agent y no habilita lecturas ni ventas `REAL`.

- Reutilizar `saleType` y `measurementUnit` existentes para distinguir ventas por unidad, peso y elección unidad/peso.
- Definir el flujo POS para que `UNIT` no dependa de una balanza, `WEIGHT` solicite pesaje y `BOTH` permita elegir explícitamente el modo de venta.
- Ocultar por completo los elementos permanentes de balanza en `/pos` cuando la terminal no tenga balanza asignada y habilitada; mostrar avisos solo en el intento contextual de una operación que requiere peso.
- Definir estados visibles para balanza configurada, desconexión, error, unidad no verificada, lectura pendiente e invalidación, sin mostrar `Balanza lista` por causa del MOCK.
- Sustituir el uso comercial implícito del MOCK por una lectura REAL bajo demanda del Peripheral Agent cuando exista configuración autorizada.
- Mantener separadas las lecturas MOCK de las lecturas REAL y no interpretar `stable: true` como estabilidad metrológica ROCHI.
- Exigir unidad física KG verificada para el alcance inicial ROCHI; no inferir KG o LB desde la trama serial.
- Emitir una autorización backend de corta duración vinculada a tenant, sucursal, terminal, sesión POS, producto, operación y dispositivo; impedir reutilización.
- Transportar evidencia de captura de forma transitoria, con expiración, origen REAL, consumo único y validación backend atómica con la operación comercial, sin persistencia permanente inicial.
- Usar apertura, lectura nueva y cierre por operación; dejar la sesión temporal como evolución posterior condicionada a evidencia operativa.
- Definir frescura, invalidación, unicidad, concurrencia, terminal propietaria y trazabilidad de cada captura.
- Reutilizar el pricing, carrito, impuestos, descuentos, inventario y venta existentes sin duplicar el cálculo comercial.
- Especificar aceptación funcional para el producto `Contra Muslo`, reportado por el operador como `BOTH` con unidad `KG`, sin alterar ni afirmar la verificación de sus datos persistidos.
- Mantener fuera de alcance la homologación metrológica, Linux, empaquetado multiplataforma y la habilitación inmediata de ventas reales.

## Fase 2C.1 documental: confianza Agent--terminal--SCALE

Esta fase documenta la extension minima para detectar, probar, asociar, habilitar, revocar y consultar una ROCHI desde la instalacion de perifericos y la operacion POS. No implementa autenticacion, migraciones, canal nuevo, lectura comercial ni cambios de datos.

Hechos confirmados:

- `terminal_devices` registra una instalacion Agent por `installation_id` y `terminal_device_bindings` vincula esa instalacion con una terminal del mismo tenant.
- `pos_terminal_peripheral_settings.scale_device_id` referencia el ID local del `PeripheralDevice`; hoy no existe una relacion persistente entre ese ID y `terminal_devices`.
- `PeripheralDevice` y su registro JSON local exponen tipo, estado, `terminalId`, `connectionType` y descriptor opcional; esto no autentica mensajes ni demuestra posesion fisica.
- El Agent escucha por loopback/CORS permitido y `ScaleController` acepta `terminalId` y `deviceId` del cliente; esos campos no son prueba suficiente de autorizacion cloud.

Propuesta: reutilizar la identidad autenticada de la instalacion y el binding cloud existentes, pero agregar una relacion verificable y un mecanismo de desafio/respuesta o credencial revocable antes de aceptar una declaracion SCALE. La eleccion concreta de credencial requiere aprobacion de seguridad. Ningun `installationId`, `terminalId`, `deviceId`, COM, PnP, USB, SERIAL o VID/PID aislado prueba identidad o posesion.

## Capabilities

### New Capabilities

- `pesaje-comercial-posagent`: Contrato comercial para capturar peso bajo demanda entre Manus POS y Peripheral Agent, incluyendo producto, terminal, unidad verificada, frescura, origen, estados, seguridad y QA.

### Modified Capabilities

- Ninguna. El modelo de producto existente no cambia; este change define cómo se consume en POS.

## Impact

- POS web/Electron: reutilización y adaptación de `PosScreen`, `CartSaleModal` y contratos de periféricos.
- Backend comercial: validación de terminal, producto, cantidad, sesión POS y evidencia de captura antes de confirmar ventas pesables.
- Peripheral Agent: adaptación futura de `ScaleService` MOCK al driver ROCHI ya validado, conservando `DevicesService`, eventos y transporte local existentes.
- Configuración: uso de `enableScale`, `scaleDeviceId`, modo y origen de configuración por tenant, sucursal y terminal.
- QA: simulador, pruebas de integración POS-Agent y QA físico posterior, sin declarar homologación metrológica.
- Dependencia: `integrar-balanza-rochi-a01e` permanece independiente y conserva pendiente su tarea 4.6.

Fase 2B implementa una extension aditiva minima en `resolve-current`: `scale.assignment`, `scale.classification` y `scale.deviceId`. El backend clasifica `mock-scale-001` como `MOCK` y cualquier otra asignacion como `UNKNOWN`; no inventa `REAL`. La vinculacion verificable tenant--sucursal--terminal--instalacion Agent--dispositivo SCALE, la autorizacion corta y la prueba de posesion del Agent siguen pendientes. No se acepta `UNKNOWN`, un `scaleDeviceId` no vacio ni `source=CONFIGURED` como prueba REAL.

## Fase 2C.2A: diseño implementable de confianza Agent--SCALE

Esta fase documental concreta el protocolo y las migraciones mínimas propuestas para desbloquear la implementación posterior. No ejecuta migraciones, no crea credenciales, no modifica código y no habilita pesaje REAL.

Decisión propuesta: usar una credencial aleatoria de alta entropía, única por instalación Agent, entregada una sola vez durante un enrolamiento administrativo autorizado. El backend conserva únicamente un verificador derivado con KDF de contraseña apropiado y metadatos de ciclo de vida; el Agent conserva el secreto en el almacén protegido del sistema operativo. No se usa HMAC con un hash de contraseña, no se guarda el secreto en WEB/Electron renderer y no se acepta `installationId`, CORS, loopback o un ID de dispositivo como autenticación.

La petición autenticada debe incluir desafío de un solo uso, audiencia, operación, instalación, timestamp y expiración. El backend valida tenant, sucursal, terminal, binding, credencial activa, nonce no consumido y ventana temporal. La revocación invalida inmediatamente. La rotación usa una ventana de transición limitada y una sola credencial nueva activa al finalizar.

Se proponen dos migraciones aditivas, aún no creadas:

- `terminal_device_credentials`: credencial revocable ligada a `terminal_devices.id`, con verificador, estado, emisión, expiración, rotación, revocación y auditoría.
- `terminal_scale_bindings`: vínculo tenant--sucursal--terminal--instalación Agent--SCALE lógico, con estado, verificación KG, última prueba y revocación. No contiene COM, PnP ni parámetros seriales.

La tabla existente `terminal_device_bindings` se reutiliza para la relación instalación Agent--terminal. `pos_terminal_peripheral_settings.scale_device_id` se conserva por compatibilidad, pero una disponibilidad REAL futura exige además un `terminal_scale_bindings` activo y una observación autenticada reciente del Agent. El `PeripheralDevice` JSON local no se convierte en FK cloud.

Electron puede usar el bridge tipado existente. WEB no puede usar el canal localhost actual para REAL sin un desafío autenticado y de un solo uso. CORS y loopback son controles de transporte, no identidad. La decisión final de almacén seguro Windows, KDF y protocolo de desafío requiere aprobación de Seguridad/Infraestructura antes de código.

## Fase 2A documental: identidad y vinculación REAL/MOCK

Esta fase solo precisa el diseño. No implementa API, Agent, persistencia, UI administrativa ni lectura física.

Hechos confirmados en el repositorio:

- `pos_terminal_peripheral_settings` guarda `scale_device_id` y `enable_scale` por terminal.
- `pos_terminals` relaciona la terminal comercial con tenant y sucursal y expone modo `MOCK|REAL|HYBRID`.
- `terminal_devices` y `terminal_device_bindings` identifican instalaciones cloud del Peripheral Agent y sus vínculos con terminales; `installationId` no es credencial ni prueba de posesión.
- El registro local del Agent distingue `DeviceType.SCALE`, `ConnectionType.MOCK`, `SERIAL` y `USB`, y documenta `mock-scale-001` como fixture MOCK.
- `resolve-current` devuelve configuración, IDs y flags, pero no origen físico confiable, identidad de instalación Agent, PnP/COM, unidad verificada ni estado conectado.
- `ScaleService` comercial aún devuelve una lectura simulada de `1.25 kg`; el driver ROCHI no está conectado a ese módulo.

Brecha y propuesta: antes de habilitar peso REAL, debe existir una vinculación verificable tenant--sucursal--terminal--instalación Agent--dispositivo SCALE. La extensión de `resolve-current`, la autorización corta y la prueba de posesión del Agent quedan como contratos propuestos y tareas futuras. No se acepta un `scaleDeviceId` no vacío ni `source=CONFIGURED` como prueba REAL.
### Fase 1B — almacenamiento local seguro del Agent

Se implementa de forma aislada `SecureSecretStore` en `backend-perifericos`.
El store usa blobs JSON versionados que contienen únicamente datos protegidos
por DPAPI `CurrentUser`; no emite credenciales, no conoce el backend y no se
conecta al flujo comercial.

La prueba unitaria usa un protector controlado y cubre ausencia, lectura,
rotación, borrado, corrupción, path traversal y concurrencia local. La
validación administrada posterior usó Node oficial `v24.21.0`, DPAPI bajo
`LocalService`, servicio temporal QA y empaquetado protegido. La Scheduled Task
interactiva no es la vía productiva.
### Fase 1B.6 — identidad y distribución Windows

El servicio productivo usa `NT AUTHORITY\\LocalService`. La Scheduled Task
interactiva queda solo para QA o uso local explícito. El instalador separa
ejecutables y datos, endurece ACL administradas y rechaza coexistencia con una
tarea o proceso Agent inesperado. La validación administrada 1B.14B certificó
`LocalService`, ACL, DPAPI, exclusión interproceso y empaquetado.
El \`SecureSecretStore\` usa un lock por identificador, creado de forma exclusiva
en el directorio protegido del blob. El lock solo contiene version, nonce,
proceso y timestamp UTC; nunca contiene secretos ni blobs DPAPI. \`set\`,
\`rotate\`, \`delete\` y las lecturas consistentes esperan con timeout acotado y
fallan cerrado si permanece ocupado.
El `SecureSecretStore` usa un lock por identificador, creado de forma exclusiva
en el directorio protegido del blob. El lock solo contiene version, nonce,
proceso y timestamp UTC; nunca contiene secretos ni blobs DPAPI. `set`,
`rotate`, `delete` y las lecturas consistentes esperan con timeout acotado y
fallan cerrado si permanece ocupado.

La liberacion valida nonce e identidad del archivo antes de eliminarlo. Un lock
abandonado no se elimina automaticamente: requiere procedimiento administrativo
separado con el Agent detenido. La rotacion conserva el ultimo blob confirmado
ante fallo. Esta fase no emite credenciales ni habilita REAL.
### Fase 1B.7/1B.15 - exclusion interproceso (contrato vigente)

En Windows el almacenamiento seguro serializa operaciones por secreto con un
Named Mutex `Local\\ManusPeripheralAgent-<sha256>`, protegido por una DACL
explícita para `LocalService`, `SYSTEM` y `Administrators`. Un helper dentro del
ejecutable de servicio conserva el ownership en el mismo OS thread y acepta solo
mensajes correlacionados `DONE`/`ABORT`. El lockfile histórico no es autoridad.
Los estados `WAIT_TIMEOUT`, `WAIT_FAILED` y `WAIT_ABANDONED` fallan cerrado; el
abandono requiere recuperación administrativa y no limpieza automática.

### Fase 1B.10 - estado de endurecimiento

El store usa una ruta de secretos explicita bajo el estado administrado de
`ProgramData` para el servicio `LocalService`; `stateDir` de otros consumidores
no se modifica indiscriminadamente. No existe migracion automatica entre
perfiles DPAPI.

La liberación productiva ya no reabre ni elimina un pathname para decidir
ownership. Usa el Named Mutex, por lo que la carrera adversarial
`REPLACEMENT_ALLOWED` del lockfile no forma parte del protocolo productivo.
La evidencia administrada QA certificó DACL/SDDL, estados WAIT, DPAPI
`CurrentUser` bajo `LocalService`, reinicio, recuperación de abandono, IPC,
Job Object y ausencia de huérfanos. Ver `REPORT-FINAL.md` en el artefacto QA
reportado en el diseño.

El rollback de ACL incluye la entrada actualmente procesada cuando una aplicación
falla parcialmente. La validación administrada certificó ACL efectiva bajo
`LocalService` y la instalación del servicio; la Scheduled Task interactiva no
es un componente productivo.

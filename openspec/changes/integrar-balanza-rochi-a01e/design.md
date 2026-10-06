# Dise?o

El parser vive en `backend-perifericos/src/modules/scale/rochi-a01e.parser.ts`, junto al proveedor de balanza existente, pero no depende de NestJS, del transporte serial ni de HTTP.

`RochiA01eParser.feed()` conserva ?nicamente un fragmento incompleto. Consume solo delimitadores exactos `CR LF`, emite lecturas v?lidas y reporta frames corruptos sin detener las siguientes lecturas. Si el fragmento supera el l?mite configurado, descarta el b?fer para evitar estado obsoleto y permite recuperaci?n.

La unidad se fija al construir el parser. `KG` conserva el valor observado; `LB` aplica `kilograms = value * 0.5`, regla exclusiva de ROCHI RC-A01E basada en la evidencia disponible. El resultado no contiene un campo de estabilidad porque la trama no lo informa.

## Estado del alcance

La evidencia aportada por el operador cubre QA f?sico Windows para cero, KG, LB, desconexi?n, reenumeraci?n CH340, recovery expl?cito, lectura nueva y cierre seguro. Esto valida comunicaci?n para las capturas ensayadas, no exactitud metrol?gica ni preparaci?n comercial.

La validación Linux, la autorización comercial y la homologación metrológica siguen pendientes. `ScaleService` resuelve ROCHI desde `DevicesService`, abre el puerto solo bajo demanda y responde `source=REAL`; antes de confirmación devuelve `unit=null`, `stable=null`, `unitVerified=false` y `stabilityVerified=false`. La pantalla administrativa de periféricos permite asociar explícitamente un SCALE descubierto a `scaleDeviceId` de la terminal mediante los settings existentes; discovery nunca crea esa asociación automáticamente. El POS solo resuelve visibilidad/configuración y mantiene la captura comercial deshabilitada.

El header POS muestra disponibilidad física desde el Agent y puede indicar ROCHI como detectada aunque el puerto esté cerrado entre lecturas. Ese indicador no concede autorización comercial y la captura por peso permanece deshabilitada.

## Discovery, persistencia e instalador

Windows descubre candidatos seriales por CH340 `VID_1A86/PID_7523`, conserva friendly name, PnP ID y COM actual, y evita duplicados al cambiar el COM. La configuración schemaVersion 1 persiste `SCALE/SERIAL/ROCHI_A01E` y `9600/8/N/1` sin flow control. El instalador usa el mismo contrato del Agent para configurar, probar lectura REAL y guardar únicamente una confirmación `OPERATOR_CONFIRMATION` de KG.

El lifecycle del instalador conserva SCM, Job Object, ACL administradas, repair y uninstall idempotente. `uninstall` normal preserva los datos; `uninstall --remove-data` elimina solo los subárboles administrados `ProgramData\\Manus\\PeripheralAgent` y el estado equivalente del perfil LocalService, derivado y validado desde el SID `S-1-5-19`. Rechaza rutas inesperadas o reparse points, no elimina el padre `Manus` si tiene otros componentes y falla explícitamente si no puede completar la limpieza solicitada. No incluye secure-secret store, credenciales, bindings cloud ni migraciones comerciales.

## Invalidacion y QA de desconexion

El transporte centraliza la invalidacion de estado. `close()`, el evento fisico `close` y un error de transporte limpian `latest`, reinician el parser, descartan el buffer inicial y eliminan cualquier fragmento pendiente. El snapshot queda sin lectura y `stale: true`; conserva `CLOSED`, `DISCONNECTED` o `ERROR` segun la causa. Cada apertura recibe una generacion; eventos tardios de una conexion anterior no pueden restaurar lecturas.

El runner `scripts/qa-rochi-disconnect.mjs` es local e interactivo. Verifica el PnP ID exacto del CH340 mediante `serialport@12`, solicita confirmaciones textuales antes de abrir/desconectar/reconectar, acepta reasignacion de COM solo con el mismo PnP ID, limita tiempos y errores, no reconecta automaticamente y cierra en `finally`.

Cada pausa usa `scripts/qa-rochi-disconnect.control.mjs`: tiene timeout de fase de 10 segundos, un presupuesto global de 60 segundos por defecto y un tope global de 60 segundos. Devuelve `TIMEOUT`, `CANCELLED`, `EOF` o `INVALID_CONFIRMATION` sin avanzar. La confirmacion tardia no se reutiliza. Ctrl+C, EOF, timeout y errores pasan por una unica limpieza; el runner cierra el adapter en `finally`.

La reconexion tiene dos gates separados: `reconnect` confirma la manipulacion fisica; despues se enumera de nuevo el CH340, se valida el PnP ID exacto y se muestra el COM vigente sanitizado. Solo un cuarto gate `recovery` puede invocar `scale.reconnect()` o reabrir con un COM reasignado.

## Fase 2: transporte serial y simulador

`RochiA01eSerialScale` recibe una factory de puerto. La factory real usa `serialport@12` en un archivo aislado; las pruebas usan `RochiA01eSimulatorPort`. As? el parser no se duplica y ning?n test requiere COM3.

La configuraci?n por defecto es `9600`, `8` bits, paridad `none`, `1` stop bit y `rtscts=false`. El `path` es obligatorio y no se fija COM3. El adapter no abre el puerto al construirse, evita doble apertura, permite `close()` y `reconnect()` expl?citos, reporta `ERROR`/`DISCONNECTED` y descarta lecturas antiguas mediante `maxReadingAgeMs`.

`serialport` usa bindings N-API para Windows/Linux. El `pkg` manifest incluye sus `dist` y prebuilds, pero el binario empaquetado a?n requiere una validaci?n de artefacto por plataforma. No se activa ning?n adapter serial desde otros perif?ricos ni desde el arranque del agent.

## Diagn?stico QA

`RochiA01eQaCapture` se conecta a los callbacks existentes del adapter. Guarda como m?ximo 8 errores, convierte la entrada a hexadecimal latin1 limitado a 32 bytes, limita el mensaje a 160 caracteres y mide tiempo relativo. Cuenta frames v?lidos, errores suprimidos, fragmento pendiente y snapshot del adapter. El runner `scripts/qa-rochi-diagnostic.mjs` exige `--port` y `--unit`, limita la duraci?n a 3 segundos y siempre intenta cerrar el puerto.

La sincronizaci?n inicial vive en el transporte, no en el parser: espera el primer `CR LF`, conserva el candidato si el parser lo reconoce como frame v?lido y descarta solo ese primer candidato inv?lido. Luego activa el modo estricto normal; por eso un `bad` posterior genera `INVALID_FRAME`.

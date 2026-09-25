# Diseño

El parser vive en `backend-perifericos/src/modules/scale/rochi-a01e.parser.ts`, junto al proveedor de balanza existente, pero no depende de NestJS, del transporte serial ni de HTTP.

`RochiA01eParser.feed()` conserva únicamente un fragmento incompleto. Consume solo delimitadores exactos `CR LF`, emite lecturas válidas y reporta frames corruptos sin detener las siguientes lecturas. Si el fragmento supera el límite configurado, descarta el búfer para evitar estado obsoleto y permite recuperación.

La unidad se fija al construir el parser. `KG` conserva el valor observado; `LB` aplica `kilograms = value * 0.5`, regla exclusiva de ROCHI RC-A01E basada en la evidencia disponible. El resultado no contiene un campo de estabilidad porque la trama no lo informa.

## Estado del alcance

La evidencia aportada por el operador cubre QA físico Windows para cero, KG, LB, desconexión, reenumeración CH340, recovery explícito, lectura nueva y cierre seguro. Esto valida comunicación para las capturas ensayadas, no exactitud metrológica ni preparación comercial.

La validación Linux y la integración con POS siguen pendientes. El `ScaleService` actual permanece MOCK; su `stable: true` describe el contrato simulado y no representa estabilidad metrológica de ROCHI.

## Invalidacion y QA de desconexion

El transporte centraliza la invalidacion de estado. `close()`, el evento fisico `close` y un error de transporte limpian `latest`, reinician el parser, descartan el buffer inicial y eliminan cualquier fragmento pendiente. El snapshot queda sin lectura y `stale: true`; conserva `CLOSED`, `DISCONNECTED` o `ERROR` segun la causa. Cada apertura recibe una generacion; eventos tardios de una conexion anterior no pueden restaurar lecturas.

El runner `scripts/qa-rochi-disconnect.mjs` es local e interactivo. Verifica el PnP ID exacto del CH340 mediante `serialport@12`, solicita confirmaciones textuales antes de abrir/desconectar/reconectar, acepta reasignacion de COM solo con el mismo PnP ID, limita tiempos y errores, no reconecta automaticamente y cierra en `finally`.

Cada pausa usa `scripts/qa-rochi-disconnect.control.mjs`: tiene timeout de fase de 10 segundos, un presupuesto global de 60 segundos por defecto y un tope global de 60 segundos. Devuelve `TIMEOUT`, `CANCELLED`, `EOF` o `INVALID_CONFIRMATION` sin avanzar. La confirmacion tardia no se reutiliza. Ctrl+C, EOF, timeout y errores pasan por una unica limpieza; el runner cierra el adapter en `finally`.

La reconexion tiene dos gates separados: `reconnect` confirma la manipulacion fisica; despues se enumera de nuevo el CH340, se valida el PnP ID exacto y se muestra el COM vigente sanitizado. Solo un cuarto gate `recovery` puede invocar `scale.reconnect()` o reabrir con un COM reasignado.

## Fase 2: transporte serial y simulador

`RochiA01eSerialScale` recibe una factory de puerto. La factory real usa `serialport@12` en un archivo aislado; las pruebas usan `RochiA01eSimulatorPort`. Así el parser no se duplica y ningún test requiere COM3.

La configuración por defecto es `9600`, `8` bits, paridad `none`, `1` stop bit y `rtscts=false`. El `path` es obligatorio y no se fija COM3. El adapter no abre el puerto al construirse, evita doble apertura, permite `close()` y `reconnect()` explícitos, reporta `ERROR`/`DISCONNECTED` y descarta lecturas antiguas mediante `maxReadingAgeMs`.

`serialport` usa bindings N-API para Windows/Linux. El `pkg` manifest incluye sus `dist` y prebuilds, pero el binario empaquetado aún requiere una validación de artefacto por plataforma. No se activa ningún adapter serial desde otros periféricos ni desde el arranque del agent.

## Diagnóstico QA

`RochiA01eQaCapture` se conecta a los callbacks existentes del adapter. Guarda como máximo 8 errores, convierte la entrada a hexadecimal latin1 limitado a 32 bytes, limita el mensaje a 160 caracteres y mide tiempo relativo. Cuenta frames válidos, errores suprimidos, fragmento pendiente y snapshot del adapter. El runner `scripts/qa-rochi-diagnostic.mjs` exige `--port` y `--unit`, limita la duración a 3 segundos y siempre intenta cerrar el puerto.

La sincronización inicial vive en el transporte, no en el parser: espera el primer `CR LF`, conserva el candidato si el parser lo reconoce como frame válido y descarta solo ese primer candidato inválido. Luego activa el modo estricto normal; por eso un `bad` posterior genera `INVALID_FRAME`.

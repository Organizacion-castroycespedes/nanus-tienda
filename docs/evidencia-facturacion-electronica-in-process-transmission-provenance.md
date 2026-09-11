# Proveniencia de transmisión `in_process` en FactuCore

Fecha: 2026-09-10

## Alcance

- Documento controlado: `33b68113-0737-4492-9bf4-ccbe84ccb58c` (`SETP990000006`).
- Investigación de código, runtime y lecturas QA.
- No se ejecutaron DIAN, polling, transmisión, XML, firma, jobs ni mutaciones.

## Hallazgo principal

El driver activo es `in_process`. `schedule()` crea un `setTimeout(..., 0)`, guarda el timer en un `Map` en memoria y retorna sin esperar el callback. No hay persistencia durable. El callback ejecuta el handler con `void ...catch(...)`; registra el error, pero no lo propaga al request original.

La bandera `FACTUCORE_BACKGROUND_JOBS_ENABLED=false` no impide `InProcessTransmissionDispatchDriver.schedule()`. Sí impide `DocumentsService.onModuleInit()` registrar el handler de ejecución y detener el scanner. Por eso el timer puede existir, pero al dispararse no encuentra `executionHandler` y termina antes de `executeQueuedTransmission()`.

En el driver pg-boss la misma bandera evita iniciar pg-boss y registrar `boss.work`; no evita el código productor `schedule()`. El término “consumer disabled” se refiere al handler in-process y al worker pg-boss, no al productor de la intención.

## Call graph

```text
queueTransmission()                 AWAITED_ASYNC: evento/audit, luego schedule
  -> driver.schedule()               SYNC dentro del request; retorna tras registrar timer
  -> setTimeout callback              BACKGROUND_CALLBACK; FIRE_AND_FORGET
  -> executionHandler                NO REGISTRADO con flag false
  -> executeQueuedTransmission()     NO ALCANZADO
  -> executeTransmission()           NO ALCANZADO
  -> TransmissionService.transmitDocument() NO ALCANZADO
  -> DIAN provider / SOAP             NO ALCANZADO
```

El método real de ejecución, cuando el handler está registrado, es `executeQueuedTransmission()` y delega en `executeTransmission()`. La llamada DIAN ocurre dentro de `transmissionService.transmitDocument()`.

## Evidencia QA

- Base FactuCore: `factucore`, esquema `public`.
- Base Manus: `manus_tienda_qa`, esquema `public`.
- Estado FactuCore: `SIGNED`.
- `TRANSMISSION_REQUESTED`: presente.
- `transmission_attempts`: cero.
- `sentAt` y `acceptedAt`: ausentes.
- Tabla `pgboss.job`: no contiene job para el documento.
- Tabla `pgboss.job_common`: no contiene job para el documento.
- El proceso activo apunta a `D:/Profe/Factucore/backend/dist/src/main`.
- El artefacto dist contiene la implementación actual de `schedule`, `onModuleInit` y `executeQueuedTransmission`.
- No hubo logs persistidos disponibles con entrada del documento. Los timestamps de `schedule`, callback y cliente DIAN son desconocidos.

## Certeza de envío

El evento inicial solo dice “transmisión programada”. La prueba determinista con driver `in_process` sin handler mostró: timer pendiente antes, timer retirado después y executor no llamado. Combinado con el retorno temprano de `DocumentsService.onModuleInit()` cuando la bandera es `false`, demuestra que el runtime aislado detiene la cadena antes de `executeQueuedTransmission()`.

`TransmissionAttempt` se crea después de que el provider retorna. En este caso no hay intento, respuesta, `sentAt` ni evidencia de cliente DIAN. La clasificación segura para el runtime configurado es `CONFIRMED_NOT_SENT`; no se debe retransmitir sin una nueva autorización.

## Tracking e idempotencia

`externalTrackingId` solo se persiste desde `transmissionResult.externalId`, después de la respuesta del provider. No existe en la fila de `transmission_attempts` actual. Por tanto, un tracking observado fuera de esa fila no prueba recepción DIAN.

La idempotencia usa estado documental, último intento, `documentId` como ID/singleton de pg-boss y `externalReference`. El documento conserva un solo registro de provider.

## Tests

- `test:transmission-dispatch`: PASS.
- `test:background-job-isolation`: PASS.
- `test:dian-async-transmission`: PASS.
- Prueba local adicional sin handler y sin provider: timer expiró, executor no fue llamado, trabajo no durable.
- FactuCore build: PASS.
- `git diff --check`: PASS; solo avisos de finales de línea.

## Siguiente acción segura

No llamar nuevamente al endpoint público. No activar workers. La siguiente acción requiere autorización separada y debe usar un núcleo single-document con guardas explícitas, después de confirmar que el envío anterior no ocurrió y de rotar el secreto expuesto.

## Seguridad

El secreto expuesto fue la credencial de conexión `DATABASE_URL` de FactuCore QA. No se repite aquí. No se pudo rotar mediante un mecanismo seguro disponible en esta sesión sin cambiar la credencial real de base y reiniciar dependencias. Por eso cualquier mutación externa queda bloqueada.

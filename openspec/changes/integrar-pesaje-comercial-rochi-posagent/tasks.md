## 1. Baseline y decisiones de contrato

### Fase 1B.17A - foundation local SERIAL/ROCHI

- [x] 1A.1 Agregar configuración serial tipada y reusable a `PeripheralDevice`.
- [x] 1A.2 Agregar perfil `ROCHI_A01E` con defaults certificados `9600/8/N/1`.
- [x] 1A.3 Validar parámetros seriales, PnP identity y coherencia `SERIAL`.
- [x] 1A.4 Persistir y restaurar configuración serial en `device-registry.state.json` sin cambiar schema 1.
- [x] 1A.5 Cubrir round-trip, estado antiguo, invalidación y preservación HTTP sin abrir hardware.
- [x] 1A.6 Mantener fuera de alcance discovery, runtime, `ScaleService`, autorización, DB y `REAL_AVAILABLE`.

## 3E. Fase 1B.9.1 - Core tÃ©cnico y recorrido visual

- [x] 3E.1 Separar finalizaciÃ³n tÃ©cnica del Core y etapa visual posterior con `STEP_SKIPPED` explÃ­cito para `DISCOVER_DEVICES` y `CONFIGURE_DEVICES`.
- [x] 3E.2 Cubrir aceptaciÃ³n de `INSTALL_SUCCEEDED` tras los skips, duplicados y continuidad del WebView hacia discovery/reintento.
- [ ] 3E.3 Ejecutar QA visual y fÃ­sico de perifÃ©ricos bajo instalaciÃ³n administrada; ROCHI, KG, autenticaciÃ³n Agent y venta `REAL` siguen pendientes.

- [x] 1.1 Confirmar en código los contratos actuales de `saleType`, `measurementUnit`, terminal activa, `scaleDeviceId`, `enableScale`, modo y origen; verificar que no se creen entidades de producto nuevas. Evidencia: `/pos-terminals/resolve-current` y `web/domains/peripherals/scale-visibility.ts`.
- [ ] 1.2 Implementar la autorización backend de corta duración vinculada a tenant, sucursal cuando aplique, terminal, sesión POS, producto, operación y dispositivo; verificar rechazo de identidad no autorizada y replay.
- [ ] 1.3 Aplicar la política aprobada: sin override manual para `WEIGHT` ni para el modo peso de `BOTH`; verificar que cantidad manual solo aplique a operaciones por unidad y nunca se etiquete como REAL.
- [ ] 1.4 Transportar evidencia transitoria con expiración y consumo único mediante el flujo comercial existente; verificar consumo atómico con venta, impuestos, inventario y facturación sin persistencia permanente inicial.
- [ ] 1.5 Implementar una sola operación abrir-leer-cerrar por pesaje; verificar timeout, cierre, dueño único, cancelación e invalidación. Dejar sesión temporal como evolución posterior.

## 2. Contrato de captura y terminal

- [ ] 2.1 Definir el contrato de captura REAL/ MOCK con fuente, unidad origen, kilogramos normalizados, timestamp, frescura, dispositivo, terminal, operación, identificador único y uso único; verificarlo con casos válidos e inválidos.
- [ ] 2.2 Implementar la resolución fail-closed de terminal sin balanza, balanza deshabilitada, dispositivo no autorizado, dispositivo ocupado, desconectado y error; verificar aislamiento por tenant, sucursal y terminal.
- [ ] 2.3 Incorporar configuración explícita de unidad ROCHI y procedimiento de verificación KG sin inferencia desde la trama; verificar rechazo de unidad desconocida, cambio de unidad y configuración inconsistente.
- [ ] 2.4 Definir TTL, cancelación, cierre, invalidación por error/desconexión y límite de concurrencia; verificar que no sobreviva una lectura usable después de cerrar o perder USB.
- [x] 2.5 Hacer que la configuración fallida o ausente sea estado seguro sin escala operativa; verificar que no active `FALLBACK_MOCK` para ventas ponderadas. Evidencia: `PosScreen` exige `source=CONFIGURED`, `scaleDeviceId` y `features.scale`.
- [ ] 2.6 Fase 2A documental: cerrar la matriz de identidad tenant--sucursal--terminal--instalación Agent--SCALE y sus restricciones de pertenencia. La relación propuesta está documentada; implementación y QA pendientes.
- [x] 2.7 Implementar la extensión aditiva conservadora de `resolve-current`: `scale.assignment`, `scale.classification` y `scale.deviceId`. `mock-scale-001` es `MOCK`; asignaciones no MOCK son `UNKNOWN` y no prueban REAL. Evidencia: servicio POS, pruebas backend y helper de visibilidad.

- [x] 2.8 Fase 2B: publicar la clasificacion conservadora del SCALE asignado en `resolve-current` y consumirla en la visibilidad POS. `MOCK` solo representa el fixture documentado; `UNKNOWN` no habilita captura REAL. Evidencia: servicio POS, tipos web, helper y pruebas focalizadas.

## 3. Peripheral Agent real

- [ ] 3.1 Adaptar `ScaleService` para seleccionar el driver ROCHI solo con configuración REAL autorizada y conservar el comportamiento MOCK explícito; verificar regresión de otros periféricos.
- [ ] 3.2 Reutilizar `DevicesService`, `DeviceType.SCALE`, eventos y transporte local existentes; verificar que el dispositivo, puerto/PnP y terminal correspondan a la configuración autorizada.
- [ ] 3.3 Implementar la operación o sesión bajo demanda elegida, con apertura, sincronización, lectura fresca, normalización KG y cierre seguro; verificar puerto ocupado, timeout, error, desconexión y liberación.
- [ ] 3.4 Impedir reconexión automática y doble dueño serial; verificar que una recuperación requiera una nueva acción explícita y que eventos tardíos no restauren lecturas.
- [ ] 3.5 Mantener separadas respuestas MOCK y REAL, retirar cualquier interpretación comercial de `stable` para ROCHI y etiquetar el origen; verificar que una respuesta MOCK no pase el gate REAL.
- [ ] 3.6 Fase 2A documental: definir vinculación de instalación Agent con terminal y SCALE, prueba de identidad física y separación de COM/PnP local frente a asignación administrativa. Implementación pendiente.
- [ ] 3.7 Fase 2A documental: seleccionar mecanismo de autorización corta, revocación, replay y consumo único con los criterios de confianza existentes. No hay token ni consulta de captura implementados.

## 3A. Fase 2C.1 - Confianza y operacion Agent--terminal--SCALE

- [ ] 3A.1 Confirmar mecanismo autenticado y revocable para la instalacion Agent; no aceptar `installationId`, `terminalId` o `deviceId` enviados por frontend como prueba.
- [ ] 3A.2 Definir y persistir, sin duplicar relaciones, la asociacion tenant--sucursal--terminal--instalacion Agent--SCALE; rechazar doble asignacion y pertenencia cruzada.
- [ ] 3A.3 Extender el flujo administrativo Detectar--Probar--Vincular--Habilitar--Revocar reutilizando `/admin/peripherals`, onboarding y `DevicesService`; registrar solo metadatos necesarios.
- [ ] 3A.4 Disenar la prueba local ROCHI: deteccion, comunicacion, lectura de prueba y verificacion manual KG; mantener COM/PnP y parametros seriales en Agent local.
- [ ] 3A.5 Definir contrato autenticado de disponibilidad con TTL, invalidacion por desconexion, revocacion, cambio de terminal, cambio de dispositivo y error; mantener UNKNOWN cuando falte evidencia.
- [ ] 3A.6 Verificar compatibilidad de Electron y WEB; bloquear WEB si solo existe localhost/CORS sin autenticacion Agent suficiente.
- [ ] 3A.7 Cubrir tenant/sucursal/terminal ajenos, Agent revocado, dispositivo falso, peticion local no autorizada, MOCK, duplicado, desconexion, expiracion y rollback. Ninguna tarea esta completada por esta documentacion.

## 3B. Fase 2C.2A - protocolo implementable pendiente de aprobación

- [ ] 3B.1 Aprobar credencial aleatoria por instalación, KDF/verificador, almacenamiento protegido Windows, rotación, expiración, revocación y auditoría. No usar `installationId`, CORS o loopback como autenticación.
- [ ] 3B.2 Crear y probar la migración propuesta `terminal_device_credentials` con FK tenant--`terminal_devices`, una credencial activa por instalación, estados y transacciones de revocación. Migración no creada ni ejecutada en esta fase documental.
- [ ] 3B.3 Crear y probar la migración propuesta `terminal_scale_bindings` con FK tenant--sucursal--terminal--`terminal_devices`, `logical_scale_id`, unicidad activa, estados y verificación KG. No crear FK hacia el JSON local `PeripheralDevice`.
- [ ] 3B.4 Implementar enrolamiento y middleware Agent con nonce, audiencia, TTL, anti-replay y rechazo de credencial revocada. Código pendiente.
- [ ] 3B.5 Implementar DetectarProbarVincularHabilitarRevocar usando el driver ROCHI existente; mantener COM/PnP y parámetros seriales en Agent local. No declarar `REAL_AVAILABLE` por una declaración solamente.
- [ ] 3B.6 Definir handshake seguro Electron/WEB; mantener WEB bloqueado mientras solo existan loopback y CORS.
- [ ] 3B.7 Añadir pruebas de tenant/sucursal ajenos, doble asignación, replay, expiración, rotación, revocación, reinstalación, cambio USB, desconexión, MOCK, UNKNOWN y rollback. Ninguna completada.

### Fase 2D — estado de implementación

- Preparadas localmente `V095__terminal_device_credentials.sql` y `V096__terminal_scale_bindings.sql`; pendientes de revisión SQL aislada y aplicación autorizada.
- Agregadas rutas administrativas de registro/consulta/revocación de credenciales y alta/consulta/revocación de vínculos SCALE. No emiten secretos ni habilitan operaciones Agent.
- TypeScript, build API y pruebas administrativas existentes pasan. La autenticación Agent, DPAPI productivo, anti-replay y captura REAL siguen pendientes.

## 4. POS y modelo de venta existente

- [ ] 4.1 Adaptar `PosScreen` y `CartSaleModal` sin duplicar paneles, hooks o stores; verificar estados visibles `Sin balanza configurada`, `Balanza deshabilitada`, disponible, desconectada, error, unidad no verificada, pendiente, inválida y capturada.
- [x] 4.2 Mantener `UNIT` operativo sin balanza y bloquear solo los controles que requieran peso; verificar venta normal en terminal sin dispositivo asignado. Evidencia: el guard solo afecta acciones de pesaje; el agregado por unidad no depende de balanza.
- [x] 4.3 Implementar elección explícita de unidad o peso para `BOTH`; verificar que cada elección use el flujo correcto y que cancelar no modifique el carrito. Evidencia QA manual 6/6: modal visible, Unidad agrega una vez, Peso muestra aviso sin agregar ni leer MOCK, Cancelar conserva carrito, no aparece UI permanente MOCK y scanner también abre el selector. Fixture reportado: `Contra Muslo` `BOTH/KG`; registro DB no verificado.
- [ ] 4.4 Mantener la cantidad manual conforme a la política resuelta en 1.3; verificar que nunca se presente como lectura física si no existe autorización.
- [ ] 4.5 Reemplazar el uso comercial implícito de `mock-scale-001` por la configuración resuelta de terminal; verificar que el fallback MOCK solo aparezca en rutas autorizadas de desarrollo/QA.
- [x] 4.6 Ocultar completamente en `/pos` todo indicador, panel, peso vivo y control de balanza cuando la terminal no tenga dispositivo asignado y habilitado; verificar que solo exista aviso contextual al intentar pesar. Evidencia: `scaleUiVisible` es falso durante carga, error, `FALLBACK_MOCK`, falta de dispositivo, `features.scale=false` o el fixture documentado `mock-scale-001`.
- [ ] 4.7 Adaptar la UI para que `Balanza Lista/Listo` solo aparezca con configuración terminal REAL y estado Agent autorizado; verificar estados desconectada, error, unidad no verificada y lectura inválida. Pendiente: esta fase no conecta el Agent REAL ni implementa captura comercial.
- [ ] 4.8 Ejecutar aceptación con fixture `Contra Muslo` reportado como `BOTH/KG`; verificar unidad sin balanza, peso con ROCHI autorizado y bloqueo contextual sin balanza, sin cambiar sus datos.

## 5. Backend comercial

- [ ] 5.1 Validar en backend `saleType`, `measurementUnit`, cantidad y terminal activa para ventas ponderadas; verificar rechazo de combinaciones inválidas aunque la UI las permita.
- [ ] 5.2 Integrar la evidencia de captura con el flujo existente de pricing, impuestos, descuentos, inventario y `/sales`; verificar que no haya cálculo duplicado ni persistencia parcial.
- [ ] 5.3 Rechazar evidencia ausente, vencida, duplicada, MOCK no autorizado, de otra terminal, de otro producto u operación, o posterior a una revocación; verificar mensajes y rollback atómico.
- [ ] 5.4 Verificar compatibilidad con POS Electron, facturación electrónica y ventas unitarias; ejecutar regresión sobre los flujos existentes.

## 6. Simulador y pruebas automatizadas

- [ ] 6.1 Cubrir `UNIT`, `WEIGHT` y `BOTH`, incluyendo elección de modo, cantidades, precios, impuestos y stock; verificar escenarios de la especificación.
- [ ] 6.2 Cubrir terminal sin balanza, deshabilitada, disponible, ocupada, desconectada, con error y con configuración revocada; verificar estados de UI y rechazo seguro.
- [ ] 6.3 Cubrir KG verificado, unidad incorrecta, unidad ambigua, lectura stale, trama inválida, timeout, cierre, desconexión, reconexión explícita y eventos tardíos; verificar invalidación inmediata.
- [ ] 6.4 Cubrir duplicación, concurrencia, cambio de producto, cambio de terminal, cruce de tenant y reutilización de captura; verificar aislamiento y uso único.
- [ ] 6.5 Cubrir separación MOCK/REAL y compatibilidad del ScaleService existente; verificar que ninguna prueba de simulador habilite una venta REAL.
- [ ] 6.6 Cubrir visibilidad terminal sin balanza: ningún indicador permanente, ventas `UNIT` operativas y aviso contextual únicamente al intentar `WEIGHT` o peso de `BOTH`. Evidencia manual registrada; cobertura automatizada de componentes sigue pendiente.

### Evidencia QA Fase 1

- Terminal 1: respuesta observada por el operador con `source=CONFIGURED`, `scaleDeviceId=mock-scale-001` y `features.scale=true`.
- Fixture: `Contra Muslo` reportado como `saleType=BOTH` y `measurementUnit=KG`; no se modificó ni se verificó directamente en DB.
- Resultado manual: 6/6 PASS para apertura del selector, Unidad una vez, Peso contextual sin MOCK, Cancelar sin cambios, ausencia de UI permanente MOCK y selección desde scanner.
- Esta evidencia no cubre captura REAL, Agent, backend comercial, ventas productivas, hardware, Linux, empaquetado ni metrología.
- [ ] 6.7 Cubrir autorización corta, expiración, revocación, replay, evidencia duplicada y consumo único atómico.

## 7. QA físico y controles de salida

- [ ] 7.1 Ejecutar QA Windows controlado con ROCHI usando KG verificado, puerto/PnP autorizado, lectura bajo demanda, desconexión, invalidación y recuperación explícita; registrar evidencia sin declarar homologación.
- [ ] 7.2 Repetir pruebas con producto `WEIGHT` y `BOTH` en terminal configurada, y confirmar que `UNIT` funciona con balanza ausente; verificar correspondencia de pantalla y captura.
- [ ] 7.3 Verificar que Linux y empaquetado multiplataforma sigan separados de este change hasta completar la tarea 4.6 histórica; no marcarla desde este cambio.
- [ ] 7.4 Ejecutar suite relevante, build, validación OpenSpec y revisión de diff; verificar ausencia de cambios en POS no relacionados, parser ROCHI histórico, ventas unitarias y facturación.
- [ ] 7.5 Obtener aprobación independiente de negocio, seguridad y metrología antes de habilitar ventas ponderadas reales; verificar que el feature permanezca deshabilitado hasta esa aprobación.
## 3C. Fase 1B — almacenamiento local seguro

- [x] 3C.1 Implementar contrato tipado `SecureSecretStore` con `get`, `set`, `rotate` y `delete`, identificadores validados, blobs versionados y separación del `agent-installation-id` público. Evidencia: `backend-perifericos/src/platform/secure-secret-store.ts`.
- [x] 3C.2 Implementar persistencia temporal, `fsync`, reemplazo Windows, ACL explícitas y fail-closed sin fallback plaintext. Evidencia: store y pruebas unitarias con protector controlado.
- [x] 3C.3 Añadir pruebas unitarias de ausencia, lifecycle, corrupción, path traversal, concurrencia y limpieza. Evidencia: `backend-perifericos/test/secure-secret-store.spec.ts`, 9/9 PASS con Node oficial `v24.21.0` en copia aislada.
- [x] 3C.4 Ejecutar prueba real DPAPI bajo Node oficial `>=24.21.0`, perfil Windows operativo y contexto de tarea QA autorizado. LocalService, restart, negative identity y fail-closed pasan en la evidencia administrada 1B.14B.
- [x] 3C.5 Certificar empaquetado Windows y ACL de distribución sin extracción nativa insegura. Packaging, validator, manifest 6/6 y ACL administradas pasan en la evidencia certificada.
- [x] 3C.6 Añadir guard de packaging para impedir artefactos Windows con Node menor que `24.21.0`. Evidencia: `backend-perifericos/scripts/package-windows-x64.mjs`; comprobado con runtime compatible en copia aislada.

### Fase 1B — validación final aislada

- [x] 3C.7 `npm ci --ignore-scripts`, build y suite Agent en copia aislada con Node oficial `v24.21.0`: build PASS y 140/140 tests PASS. El manifest completo certificado pasó 6/6; la observación histórica 5/6 era de una copia sin fixture Electron.
- [x] 3C.8 DPAPI y SecureSecretStore con Node oficial: 9/9 pruebas focalizadas PASS, runtime embebido `v24.21.0` y validador Windows PASS.
- [x] 3C.9 Certificar ACL administradas de distribución. La evidencia 1B.14B certifica DACL mínima del run y la instalación administrada; no implica que una Scheduled Task sea productiva.
- [x] 3C.10 Certificar concurrencia interproceso formal. Named Mutex, contención, independencia por secreto y recuperación de abandono pasan bajo LocalService.
## 3D. Fase 1B.6 — identidad y distribución Windows

- [x] 3D.1 Formalizar `LocalService` como identidad productiva y conservar la Scheduled Task interactiva solo para QA/local controlado.
- [x] 3D.2 Añadir preflight no destructivo para identidad del servicio, tarea conocida y ocupación inesperada de `127.0.0.1:4050`.
- [x] 3D.3 Endurecer ACL de rutas Manus administradas con herencia retirada, ACE amplias removidas, permisos separados y rollback ante fallo.
- [x] 3D.4 Sustituir `npm.cmd` con `shell:true` por `process.execPath` + `npm-cli.js` con `shell:false`.
- [x] 3D.5 Ejecutar pruebas aisladas de Go, packaging y ACL bajo una instalación temporal; validar después con servicio QA bajo `LocalService`. Evidencia 1B.14B y packaging certificado.
## 3F. Fase 1B.7 - exclusion interproceso del SecureSecretStore

- [x] 3F.1 Integrar Named Mutex Windows por secreto, con nombre derivado sin secreto, timeout acotado, orden estable junto al lock intraproceso y helper en el OS thread propietario. Evidencia: `backend-perifericos/src/platform/secure-secret-store.ts` y `backend-perifericos/windows-installer/secure_secret_mutex_windows.go`.
- [x] 3F.2 Reemplazar el lockfile como autoridad Windows por `WAIT_OBJECT_0`, `WAIT_TIMEOUT`, `WAIT_ABANDONED` y `WAIT_FAILED`, con `DONE`/`ABORT` correlacionados y fail-closed. Evidencia administrada 1B.14B; el lockfile queda solo diagnóstico.
- [x] 3F.3 Cubrir operaciones concurrentes entre procesos, timeout, metadata incompleta, preservación del blob y recuperación manual documentada con secretos ficticios. Evidencia administrada 1B.14B con Node oficial `v24.21.0`.
- [x] 3F.4 Ejecutar validación completa con Node oficial `>=24.21.0`, suite Agent y DPAPI real después de esta implementación. LocalService, ACL administradas y restart quedan certificados por la evidencia QA.

## 3G. Fase 1B.10 - endurecimiento de ruta, lock y rollback ACL

- [x] 3G.1 Separar `secureSecretDir` de `stateDir` y resolverlo bajo `ProgramData\\Manus\\PeripheralAgent\\state\\secrets` en Windows; no migrar blobs entre perfiles DPAPI. Evidencia: prueba de limites de plataforma y suite Agent `143/143`.
- [x] 3G.2 Cerrar la carrera TOCTOU de liberacion del lock con Named Mutex Windows; la prueba adversarial `REPLACEMENT_ALLOWED` queda cubierta al retirar `unlink` del protocolo de autoridad. Evidencia: QA administrado 1B.14B y `secure_secret_mutex_windows.go`.
- [x] 3G.3 Incluir la ACL de la ruta actualmente fallida en el rollback y cubrir la seleccion de backups con prueba Go. Evidencia: `go test ./...` PASS.
- [x] 3G.4 Verificar ACL efectiva, DPAPI, persistencia y recuperación bajo instalación QA real `LocalService`. Evidencia externa: `C:\\ManusQA\\evidence\\1B14B-FINAL-20260929-164755-bcc7300e\\REPORT-FINAL.md`; no son secretos ni producción.

### Correccion de evidencia de validacion

La evidencia actualizada de Fase 1B.10 sustituye los conteos historicos: suite
Agent `143/143 PASS`, SecureSecretStore y rutas `22/22 PASS`, build aislado
`PASS`, DPAPI CurrentUser real `PASS`, packaging y validador `PASS`, Go
installer tests `PASS` y OpenSpec strict `PASS`. El manifest queda `6/6 PASS`
en la copia temporal con sus fixtures disponibles. La evidencia administrada
1B.14B además certifica LocalService, ACL efectivas, DPAPI, mutex y ausencia de
huérfanos; no convierte la Scheduled Task en una vía productiva.

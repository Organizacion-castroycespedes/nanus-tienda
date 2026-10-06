## 6. Preparacion de desconexion y reconexion

- [x] 6.1 Centralizar la invalidacion inmediata en cierre voluntario, cierre fisico y error de transporte.
- [x] 6.2 Ignorar eventos tardios de conexiones anteriores mediante generacion de conexion.
- [x] 6.3 Cubrir desconexion, error, concurrencia, fragmentos pendientes, reconexion y recursos con simulador.
- [x] 6.4 Agregar runner local interactivo con PnP ID exacto, confirmaciones, limites y cierre seguro.
- [x] 6.5 Documentar procedimiento, bloqueantes fisicos y ausencia de ventas reales.

## 7. Control temporal del runner interactivo

- [x] 7.1 Aplicar timeout real a cada pausa de autorizacion y distinguir `TIMEOUT` de fallo de producto.
- [x] 7.2 Aplicar presupuesto global, cancelacion, EOF, respuestas invalidas y rechazo de confirmaciones tardias.
- [x] 7.3 Cubrir los controles con pruebas deterministas sin hardware y documentar los limites efectivos.

## 9. Presupuesto global para QA fisico

- [x] 9.1 Confirmar que el bloqueo anterior fue exclusivamente falta de presupuesto global restante.
- [x] 9.2 Ampliar el tope global del runner a 60 segundos sin cambiar el timeout individual de 10 segundos.
- [x] 9.3 Cubrir el nuevo tope, expiracion por presupuesto restante y limpieza segura sin hardware.

## 8. Gate independiente de recovery

- [x] 8.1 Validar identidad CH340 y COM vigente despu?s de la confirmaci?n f?sica.
- [x] 8.2 Exigir confirmaci?n `RECOVERY` antes de `scale.reconnect()` o reapertura.
- [x] 8.3 Probar identidad incorrecta, COM reasignado, timeout y exactamente una recuperaci?n.

## 1. Architecture and scope

- [x] 1.1 Inspect existing Peripheral Agent scale contracts and test conventions.
- [x] 1.2 Keep implementation inside `backend-perifericos` without endpoint, DB, POS, or serial transport changes.

## 2. Parser

- [x] 2.1 Implement strict `DDD.DDD` plus `CR LF` parsing.
- [x] 2.2 Support fragmented and concatenated input.
- [x] 2.3 Reject corrupt ASCII frames and recover after corruption.
- [x] 2.4 Protect the bounded buffer and clear stale fragments after overflow.
- [x] 2.5 Require explicit `KG`/`LB` and apply only the ROCHI `LB * 0.5` conversion.
- [x] 2.6 Avoid stability inference.

## 3. Tests and validation

- [x] 3.1 Add tests using the documented physical captures.
- [x] 3.2 Run targeted tests, build, lint if available, and OpenSpec validation. `backend-perifericos` build and full TypeScript suite pass for the ROCHI tests; no lint script exists; OpenSpec strict validation passes. Full package test remains blocked by two unrelated Electron manifest failures.
- [x] 3.3 Document hardware and production limitations.

## 4. Fase 2: transporte serial y simulador

- [x] 4.1 Evaluar y agregar `serialport@12` aislado detr?s de una factory inyectable.
- [x] 4.2 Implementar configuraci?n 9600 8N1 sin flow control y path obligatorio.
- [x] 4.3 Implementar lifecycle controlado, errores, desconexi?n, reconexi?n expl?cita y recursos.
- [x] 4.4 Implementar antig?edad m?xima y etiqueta `REAL`/`SIMULATED`.
- [x] 4.5 Implementar simulador sin hardware para chunks, frames, errores y desconexi?n.
- [x] 4.6 Validar tests, build, OpenSpec y empaquetado Windows x64.

## 5. Diagn?stico f?sico acotado

- [x] 5.1 Confirmar que el ejecutor f?sico previo era inline y no persist?a detalle de errores.
- [x] 5.2 Agregar captura acotada de c?digo, entrada hexadecimal, mensaje, tiempo, frames v?lidos y estado.
- [x] 5.3 Distinguir error de parser, fragmento pendiente y cierre mediante snapshot diagn?stico.
- [x] 5.4 Agregar runner expl?cito de m?ximo 3 segundos sin apertura autom?tica.
- [x] 5.5 Reproducir startup `45 CR LF` y corregir sincronizaci?n m?nima en transporte.
- [x] 5.6 Ejecutar una nueva captura f?sica solo con autorizaci?n del operador. La evidencia de consola aportada registra la sesi?n autorizada de desconexi?n, reenumeraci?n y recovery, con 22 tramas nuevas `000.000` y cierre final seguro.

## 10. Integración física final

- [x] 10.1 Descubrir CH340 por VID/PID y reconciliar cambios de COM por identidad PnP sin duplicados.
- [x] 10.2 Persistir `SCALE/SERIAL/ROCHI_A01E` con `9600/8/N/1` y friendly name intacto.
- [x] 10.3 Exponer lectura REAL bajo demanda con unidad y estabilidad no inferidas.
- [x] 10.4 Integrar configuración, prueba y confirmación KG explícita en el instalador.
- [x] 10.5 Mantener POS UNIT operativo y WEIGHT/BOTH fail-closed sin captura comercial.
- [x] 10.7 Limpiar el estado administrado LocalService mediante `uninstall --remove-data`, sin seguir reparse points ni borrar padres compartidos.
- [x] 10.6 Excluir migraciones, terminal auth/bindings, secure-secret future, enrollment y metrología.
- [x] 10.8 Permitir asociar o desasociar explícitamente un SCALE descubierto en los settings existentes de la terminal, preservando el fail-closed comercial.

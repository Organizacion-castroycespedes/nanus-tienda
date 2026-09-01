-## 1. Discovery

- [x] 1.1 Inventariar el estado actual de `backend-perifericos`, sus scripts,
  config, salud, logs y discovery por plataforma.
- [x] 1.2 Documentar el flujo manual actual de instalacion, arranque,
  reinstalacion y autostart en Windows.
- [x] 1.3 Documentar el flujo manual o ausente en Linux y las diferencias
  reales frente a Windows.
- [x] 1.4 Registrar dependencias runtime, variables de entorno, puertos y
  archivos de configuracion relevantes.
- [x] 1.5 Revisar OpenSpec y docs existentes relacionados para evitar
  duplicar soluciones o promesas.

## 2. Design multiplatform

- [x] 2.1 Definir el layout estable de Windows y Linux para binarios, config,
  state y logs.
- [x] 2.2 Definir nombres canonicos de servicio, cuenta de ejecucion y reglas
  de permisos por SO.
- [x] 2.3 Definir el modelo de config local y los overrides por entorno.
- [x] 2.4 Definir comportamiento esperado para instalacion nueva, reinstall,
  upgrade y fallo parcial.
- [x] 2.5 Definir la base de manifiesto y metadatos para un futuro `Manus
  Updater`.

## 3. Packaging

- [x] 3.1 Crear el mecanismo reproducible para generar artefactos instalables
  Windows x64.
- [x] 3.2 Crear el mecanismo reproducible para generar artefactos instalables
  Linux x64.
- [x] 3.3 Emitir manifiestos, checksums y metadata de version para cada
  artefacto.
- [x] 3.4 Agregar validaciones que prueben que el artefacto no requiere Node,
  npm ni Git global en el target.

## 4. Windows installer and service

- [x] 4.1 Implementar el bootstrapper o instalador Windows que copie el bundle
  a la ruta estable y materialice la config local.
- [x] 4.2 Registrar el servicio `ManusPeripheralAgent` con inicio automatico.
- [x] 4.3 Agregar comandos de install, repair, status y uninstall idempotentes.
- [x] 4.4 Ejecutar health gate despues de arrancar el servicio.
- [x] 4.5 Verificar que la segunda ejecucion no duplique servicio ni
  sobreescriba configuracion sin necesidad.
- [x] 4.6 Corregir el `ImagePath` de SCM para que conserve comillas reales en
  el ejecutable y no guarde `\"` literales.
- [ ] 4.7 Pasar el ejecutable y los argumentos por separado a
  `mgr.CreateService` para evitar doble escaping de SCM.

## 5. Linux installer and systemd

- [ ] 5.1 Implementar el instalador Linux que despliegue el bundle en
  `/opt/manus/...` y escriba config local.
- [ ] 5.2 Crear la unidad `manus-peripheral-agent.service` con enable/start.
- [ ] 5.3 Agregar comandos de install, repair, status y uninstall idempotentes.
- [ ] 5.4 Ejecutar health gate despues de arrancar `systemd`.
- [ ] 5.5 Verificar que el instalador detecte arquitectura y entorno
  compatibles.

## 6. Health, logs and idempotency

- [ ] 6.1 Definir el estado de instalacion, ultimo health y version activa.
- [ ] 6.2 Implementar restauracion segura ante instalacion fallida o parcial.
- [ ] 6.3 Asegurar que los logs de instalacion y runtime queden separados.
- [ ] 6.4 Asegurar que no se impriman secretos en consola ni en archivos de
  log.

## 7. Automated tests

- [ ] 7.1 Agregar tests unitarios para layout, manifiesto y resolucion de
  rutas.
- [ ] 7.2 Agregar tests para la logica de idempotencia y rollback del
  instalador.
- [ ] 7.3 Agregar tests para el comando de health gate y los estados de salida.
- [ ] 7.4 Agregar pruebas de empaquetado para Windows y Linux sin tocar
  hardware real.

## 8. Windows QA

- [ ] 8.1 Preparar matriz de QA fisico Windows para instalacion limpia,
  reinstalacion, reboot, autoarranque y health.
- [ ] 8.2 Documentar la verificacion con al menos un periferico real cuando se
  autorice.
- [ ] 8.3 Documentar instalacion, desinstalacion y recuperacion en los 3
  equipos Windows disponibles.

## 9. Linux QA

- [ ] 9.1 Preparar matriz de QA tecnico reproducible en VM o entorno controlado
  Linux x64.
- [ ] 9.2 Validar install, restart, reboot, health y logs con `systemd`.
- [ ] 9.3 Documentar claramente que QA fisico Linux no se marca PASS si solo se
  uso VM.

## 10. Closure

- [ ] 10.1 Ejecutar OpenSpec strict para el change completo.
- [ ] 10.2 Ejecutar build, tests y `git diff --check`.
- [ ] 10.3 Consolidar la evidencia QA de descubrimiento, diseno y validacion.
- [ ] 10.4 Dejar listo el siguiente paso de implementacion productiva sin
  auto-update remoto.

# Risks

## 1. Service permissions

El riesgo mas alto es dar privilegios de mas al servicio Windows o Linux.
Mitigacion: usar cuentas de minimo privilegio, ACL explicitas y solo una ruta
mutable para config, state y logs.

## 2. Partial install or upgrade

Un upgrade interrumpido puede dejar archivos mezclados o una version rota.
Mitigacion: staging temporal, swap atomico, health gate y rollback a la
version previa.

## 3. Linux distribution variance

No todas las distros x64 tienen el mismo nivel de soporte o la misma
configuracion de `systemd`.
Mitigacion: validar `x86_64`, `systemd` y `os-release` al inicio, luego fallar
con mensaje claro si el entorno no es soportado.

## 4. Windows service account and printer access

La cuenta de servicio puede no tener acceso suficiente a ciertas colas de
impresion o al entorno de discovery.
Mitigacion: probar con cuenta minima, ajustar ACL solo sobre recursos
necesarios y dejar el bundle inmutable.

## 5. Health false positive

El proceso puede responder `GET /health` antes de que el entorno operativo este
listo para QA hardware.
Mitigacion: usar health solo como gate de instalacion y dejar discovery/
hardware validation para QA adicional.

## 6. Future updater trust chain

Sin checksum, firma y metadata estable, un updater futuro seria fragile.
Mitigacion: reservar `manifest.json`, version, checksum y canal desde este
change, pero sin activar descarga remota.

## 7. Secret leakage

La config local o los logs pueden terminar imprimiendo tokens, rutas sensibles o
datos operativos.
Mitigacion: no guardar secretos en config local, sanitizar logs y limitar la
salida del instalador.

## 8. Host packaging tool variance

`pkg` y `tar` pueden comportarse distinto segun el host Windows/Linux y la forma
en que resuelven rutas absolutas.
Mitigacion: usar rutas relativas dentro del directorio de trabajo para el
tarball, validar ambos OS en CI y mantener el bundle autocontenido sin depender
de Node global.

## 9. Windows service account reach

`LocalService` puede no tener acceso suficiente en algunas combinaciones de
spooler, discovery o drivers.
Mitigacion: mantener la decision documentada, validar en QA fisico y permitir
una futura cuenta configurable si se encuentra una terminal que lo requiera.

## 10. Junction and uninstall metadata drift

El puntero `current` y la entrada de uninstall pueden quedar inconsistentes si
un install falla a mitad de camino.
Mitigacion: stage temporal, activacion atomica, rollback al ultimo versionado
bueno y escritura de metadata solo tras health PASS.

## 11. Go embed exclusion of leading underscore assets

El host Windows del instalador puede embebir un bundle incompleto si el
patron de `go:embed` no incluye archivos o directorios que empiezan con `_` o
`.`. Ese caso rompe dependencias transitive del runtime empaquetado y se ve
como un fallo generico del servicio.
Mitigacion: usar `all:` en el embed, agregar test de regresion sobre un asset
con `_`, y validar el runtime instalado antes de repetir QA fisico.

## 12. Windows service ImagePath quoting

Registrar el `ImagePath` con `syscall.EscapeArg` sobre el ejecutable puede
guardar comillas escapadas literalmente en SCM, por ejemplo `\"...\"
service`, y el servicio termina sin arrancar aunque el binario exista.
Mitigacion: quote manual del ejecutable para SCM, test que verifique ausencia
de `\"`, y validacion fisica del `ImagePath` real con `sc qc`.

## 13. Double escaping through CreateService wrapper misuse

Aunque el helper local construya una command line correcta, si se pasa esa
cadena ya compuesta al parametro `exepath` de `mgr.CreateService` el paquete
`x/sys/windows/svc/mgr` vuelve a escapar el ejecutable y termina almacenando un
`ImagePath` incorrecto. El sintoma es un servicio que existe pero no arranca.
Mitigacion: pasar `layout.ServiceExe` como `exepath` y los argumentos en
`args...`, con un test que cubra la estructura final de registro.

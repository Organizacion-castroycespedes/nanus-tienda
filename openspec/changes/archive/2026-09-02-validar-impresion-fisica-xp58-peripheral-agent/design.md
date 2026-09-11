## Context

La estacion Windows QA tiene una XP-58 funcional en la cola `XP-58`, tipo
`Local`, puerto `USB001`. Windows Test Page ya produjo papel. El runtime
instalado es `0.1.0` y no contiene los cambios REAL/CORS/PNA/discovery que ya
estan validados en fuente. El installer previo tiene un problema conocido al
reparar la misma version; ese flujo permanece pausado.

La validacion cruza packaging Windows, servicio local, spooler, navegador de
produccion y configuracion por terminal. El estado persistente vive fuera de
las versiones inmutables, bajo `C:\ProgramData\Manus\PeripheralAgent`.

## Goals / Non-Goals

**Goals:**

- Generar `0.1.1-qa.2` como artefacto Windows x64 self-contained y visible en
  `/health`.
- Usar el camino de upgrade `0.1.1-qa.1 -> 0.1.1-qa.2`, nunca repair same-version.
- Preservar el JSON local y `agentInstallationId` durante el upgrade.
- Detectar XP-58 mediante el filtro existente `Local / USB*|DOT4USB*`, sin
  imponer un ancho de papel durante discovery.
- Asociar el dispositivo con `THERMAL_58MM` y validar impresiones fisicas
  directa, UI y, solo si es seguro, POS.
- Mantener CORS allow-list exacta y PNA condicionado al origen autorizado.

**Non-Goals:**

- Reparar installer same-version, Linux, Electron, updater remoto, rollout o
  versionado remoto.
- Ampliar discovery a LPT/WSD/IP/COM.
- Certificar corte fisico o cambiar reglas de venta.
- Declarar PASS fisico usando solamente respuestas HTTP o `bytesSent`.

## Decisions

### Version QA semver prerelease

Se usa `0.1.1-qa.2`. Es mayor que `0.1.1-qa.1`, evita el camino repair y conserva
semantica SemVer de prerelease. `package.json`, `package-lock.json`, `VERSION`
y el manifest del installer deben coincidir.

Alternativa descartada: reutilizar `0.1.0`. Activa el bug conocido de repair y
no permite demostrar que `/health` ejecuta el runtime nuevo.

### Runtime self-contained existente

Se reutiliza `package:windows-x64`: app compilada, dependencias de produccion y
`node.exe` embebido. La estacion destino no requiere Node, npm ni Git.

### Upgrade controlado mediante version inmutable

El installer copia a `versions/0.1.1-qa.2`, preserva ProgramData, cambia
`current`, registra el servicio contra el ejecutable de la nueva version y
exige health con la version exacta. El installer solo siembra config cuando el
archivo externo no existe.

La identidad se preserva porque `agentInstallationId` permanece en
`ProgramData/state`, que el upgrade no elimina.

Alternativa descartada: reemplazar archivos del runtime activo. Puede producir
`Access denied`, mezcla binarios y no ofrece rollback claro.

### Config QA explicita y sin corte

El paquete QA incluye template con `mode=REAL`, allow-list Manus exacta,
adapters reales, RAW y `usbRawPhysicalCutCertified=false`. En una maquina ya
instalada, el JSON existente se preserva y se aplica manualmente para esta QA.

### Discovery conservador

La XP-58 es candidata porque su cola es `Local / USB001`. Discovery devuelve
hardware sin `profileId`; la configuracion posterior selecciona y persiste
`THERMAL_58MM` o `THERMAL_80MM`. `test-print` usa siempre el perfil persistido.

### Evidencia por capas

Windows Test Page, Agent discovery, test directo, test UI y POS tienen estados
separados. AC7/AC8/AC9 requieren observacion de papel real.

## Risks / Trade-offs

- [El servicio `LocalService` no ve una cola instalada solo por usuario] ->
  revisar inventario del log del servicio antes de cambiar discovery.
- [Upgrade falla despues de cambiar `current`] -> health gate, version
  inmutable y rollback a la version previa; no ejecutar en fisico hasta validar
  installer y respaldar config/identidad.
- [Config antigua preservada mantiene MOCK] -> respaldo y aplicacion manual del
  JSON QA antes de reiniciar.
- [RAW produce bytes pero la XP-58 no interpreta ESC/POS] -> exigir papel real y
  conservar Windows Test Page como diagnostico independiente.
- [Navegador bloquea loopback por CORS/PNA] -> probar preflight desde origen
  productivo y conservar allow-list exacta.
- [Installer prerelease ensucia camino futuro] -> artefacto claramente rotulado
  QA; no rollout ni publicacion remota.

## Migration Plan

1. Capturar health, version, identidad, cola y SHA256 previo.
2. Respaldar config externa.
3. Construir y validar bundle/installer `0.1.1-qa.2` sin ejecutar repair.
4. Verificar SHA256 y ejecutar `install` elevado como upgrade.
5. Aplicar config REAL QA, reiniciar y comprobar version/identidad.
6. Ejecutar discovery, asociacion y pruebas fisicas por capas.
7. Si health gate falla, conservar evidencia y volver a `0.1.0`; no improvisar
   reemplazo del EXE activo.

## Open Questions

- Confirmar si `LocalService` ve la cola XP-58 en la maquina QA.
- Confirmar que el upgrade real mantiene el mismo `agentInstallationId`.
- Confirmar si la prueba POS puede hacerse sin crear una venta productiva; si
  no, AC9 queda fuera de esta ejecucion.

# Estrategia de soporte Electron por sistema operativo

Fecha: 2026-06-20  
Alcance: soporte conceptual. No crea instaladores, pipelines ni dependencias Electron.

## Prioridad recomendada

| Prioridad | Sistema | Motivo |
| --- | --- | --- |
| 1 | Windows | Mayor probabilidad de uso en POS fisico, usuarios no tecnicos y perifericos comerciales. |
| 2 | Linux | Util para terminales economicas o dedicadas, pero con mas variabilidad por distribucion. |
| 3 | macOS | Util para administracion o estaciones mixtas, menos comun como caja fisica tradicional. |

## Windows

### Prioridad

Windows debe ser la prioridad inicial para Electron POS fisico.

### Artefactos posibles

- `.exe`
- `.msi`

### Proceso de build conceptual

1. Preparar web build compatible con Electron.
2. Empaquetar Electron para Windows x64.
3. Firmar instalador si aplica.
4. Validar instalacion en Windows objetivo.
5. Validar POS/caja online.
6. Validar perifericos fisicos prioritarios.

### Requisitos tecnicos

- Windows soportado por la politica de producto.
- Permisos de instalacion.
- Acceso a red hacia API cloud.
- Certificados/firmas si se distribuye a clientes no tecnicos.
- Drivers de impresora, balanza, lector QR/codigo de barras, cajon o hardware que aplique.

### Estrategia de actualizacion conceptual

- Fase inicial: instalador manual controlado.
- Fase posterior: auto-update con canal QA/produccion.
- Mantener version Electron visible para soporte.

### Compatibilidad esperada con perifericos

Validacion prioritaria:

- Impresora termica.
- Cajon monedero.
- Balanza.
- Lector QR/codigo de barras.
- POS/payment terminal si aplica como integracion externa futura.

Windows suele ser mejor opcion inicial para clientes no tecnicos porque hay mas soporte comercial, instaladores conocidos y drivers de fabricantes.

### Riesgos

- Antivirus o SmartScreen bloquean instalador sin firma.
- Drivers de hardware varian por modelo.
- Permisos locales pueden bloquear puertos USB/serial/red.
- Actualizaciones Windows pueden afectar perifericos.

### Nivel de soporte recomendado

Soporte inicial completo para piloto Electron online, limitado a versiones Windows certificadas y hardware validado.

## Linux

### Prioridad

Linux debe ser soporte posterior, no primera ola.

### Artefactos posibles

- AppImage.
- `.deb`.
- `.rpm`.

### Proceso de build conceptual

1. Definir distribuciones objetivo.
2. Generar paquete por formato.
3. Validar instalacion sin privilegios cuando aplique.
4. Validar POS/caja online.
5. Validar drivers y permisos de dispositivos por distribucion.

### Requisitos tecnicos

- Distribucion y version soportada.
- Librerias base requeridas por Electron.
- Permisos para dispositivos USB/serial.
- Red hacia API cloud.
- Procedimiento de soporte remoto.

### Estrategia de actualizacion conceptual

- AppImage manual para pilotos.
- Repositorio `.deb`/`.rpm` si hay volumen suficiente.
- Canal estable controlado por soporte.

### Compatibilidad esperada con perifericos

Linux puede servir para terminales economicas o dedicadas. Debe revisarse caso por caso:

- Compatibilidad de drivers.
- Reglas `udev`.
- Permisos serial/USB.
- Soporte de impresora.
- Integracion de balanza o scanner.

### Riesgos

- Mayor variabilidad por distribucion.
- Soporte tecnico mas exigente.
- Hardware POS puede tener drivers solo Windows.
- Paquetes pueden requerir dependencias de sistema.

### Nivel de soporte recomendado

Soporte posterior acotado a una matriz corta de distribuciones certificadas. No prometer soporte Linux general.

## macOS

### Prioridad

macOS debe ser soporte posterior.

### Artefactos posibles

- `.dmg`
- `.pkg`

### Proceso de build conceptual

1. Empaquetar app para macOS.
2. Firmar con certificado Apple.
3. Notarizar para distribucion fuera de App Store.
4. Validar Gatekeeper.
5. Validar POS/caja online y perifericos disponibles.

### Requisitos tecnicos

- Cuenta Apple Developer si se distribuye formalmente.
- Firma y notarizacion.
- Versiones macOS objetivo.
- Red hacia API cloud.
- Revision de drivers de hardware.

### Estrategia de actualizacion conceptual

- Instalador firmado para pilotos.
- Auto-update firmado en fase posterior.
- Canal separado si la version macOS requiere ajustes.

### Compatibilidad esperada con perifericos

macOS puede ser util para administracion o estaciones mixtas. Para caja fisica tradicional hay que revisar caso por caso:

- Impresora termica compatible.
- Driver de balanza.
- Scanner compatible.
- Permisos de dispositivos.

### Riesgos

- Firma y notarizacion agregan complejidad.
- Hardware POS tradicional puede no tener buen soporte macOS.
- Politicas de seguridad del sistema pueden bloquear integraciones locales.
- Menor base instalada para caja fisica.

### Nivel de soporte recomendado

Soporte posterior limitado, orientado a estaciones mixtas o administracion. No tomarlo como prioridad inicial para caja fisica.

## Matriz resumen

| Sistema | Prioridad | Artefactos | Uso recomendado | Nivel de soporte |
| --- | --- | --- | --- | --- |
| Windows | 1 | `.exe`, `.msi` | POS/caja fisica | Inicial completo para piloto |
| Linux | 2 | AppImage, `.deb`, `.rpm` | Terminal dedicada/economica | Posterior, distros certificadas |
| macOS | 3 | `.dmg`, `.pkg` | Administracion o estacion mixta | Posterior, limitado |

## Decision de fase

La primera fase Electron debe enfocarse en Windows online. Linux y macOS quedan como soporte posterior. Ningun sistema operativo implica offline en esta fase.

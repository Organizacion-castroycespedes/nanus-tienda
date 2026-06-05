# Propuesta: add-pos-peripherals-platform

## Resumen ejecutivo

Manus POS necesita una plataforma transversal para operar perifericos fisicos y simulados en terminales POS reales, sin acoplar el Backend API principal al hardware.

La propuesta crea la capacidad conceptual **Manus Peripheral Platform**, tambien referida tecnicamente como `backend-perifericos` o `peripheral-agent`. Este componente se ejecutara localmente en la terminal POS y expondra HTTP local y WebSocket local para que Manus POS pueda imprimir, abrir caja, leer balanza, recibir scanner y diagnosticar dispositivos.

Esta fase solo crea artefactos OpenSpec. No implementa codigo funcional, migraciones, dependencias, drivers, frontend ni empaquetado.

## Contexto de negocio

Manus POS es una plataforma POS multi-tenant desarrollada por Castro & Cespedes Development para minimarkets, tiendas, autoservicios, restaurantes, cafeterias, panaderias, ferreterias y comercios minoristas.

El Backend API principal concentra el core de negocio:

- Ventas.
- Inventario.
- Compras.
- Proveedores.
- Clientes.
- Caja.
- Reporteria.
- Facturacion electronica en evolucion.
- Usuarios.
- Roles.
- Permisos.

La operacion diaria de un punto fisico requiere hardware local: impresora termica POS, caja registradora, balanza electronica, scanner QR, lector de codigo de barras, terminales POS Android, dispositivos USB, seriales e HID.

## Problema actual

Manus POS opera principalmente como aplicacion web. Esa modalidad es adecuada para administracion, inventario, compras, reportes y configuracion, pero limita la comunicacion directa y estable con perifericos fisicos.

Problemas principales:

- El navegador no debe hablar directamente con hardware fisico.
- El Backend API principal no debe depender de drivers locales, puertos seriales, USB, HID ni ESC/POS.
- La operacion de caja necesita respuestas locales aun cuando el hardware este conectado a una terminal especifica.
- QA y desarrollo necesitan modo simulador para probar flujos sin hardware real.
- Electron y Capacitor requieren estrategias distintas para acceso local y seguridad.

## Necesidad del negocio

Manus POS debe evolucionar para operar en entornos comerciales reales con hardware local, manteniendo desacoplado el core de negocio.

Necesidades iniciales:

- Registrar terminales POS por tenant y sucursal.
- Registrar perifericos por terminal.
- Asignar impresoras, cajas, balanzas y scanners.
- Probar perifericos en modo real futuro o modo `MOCK/SIMULATOR`.
- Consultar salud y logs tecnicos.
- Recibir eventos locales por WebSocket.
- Soportar Web POS, Desktop POS con Electron y evaluar Android POS con Capacitor.

## Vision del producto

La vision es crear **Manus Peripheral Platform**:

```text
Manus POS Web / Electron / Capacitor
        |
        | HTTP local / WebSocket local
        v
backend-perifericos / peripheral-agent
        |
        | USB / Serial / HID / ESC-POS / drivers locales
        v
Perifericos fisicos o simulados
```

En paralelo, el flujo de negocio se mantiene intacto:

```text
Manus POS Frontend
        |
        v
Backend API Manus POS
        |
        v
PostgreSQL
```

## Objetivo estrategico

Construir una plataforma desacoplada para perifericos fisicos y simulados, permitiendo que Manus POS opere como solucion comercial completa en terminales web, desktop y moviles sin contaminar la arquitectura del Backend API principal.

Historia principal:

HU-000 Plataforma de Perifericos Manus POS: Como empresa desarrolladora de Manus POS, quiero construir una plataforma desacoplada para la gestion de perifericos fisicos y simulados, para permitir que Manus POS opere como una solucion comercial completa en terminales POS web, desktop y moviles sin comprometer la arquitectura actual del Backend API.

## Alcance inicial

Incluye disenar soporte para:

- Registro de terminales POS.
- Registro de perifericos.
- Asignacion de perifericos a terminales.
- Modo `MOCK/SIMULATOR`.
- Estado de conexion de dispositivos.
- Impresion de prueba.
- Apertura de caja registradora.
- Lectura de peso desde balanza.
- Lectura de QR/codigo de barras.
- Logs tecnicos de perifericos.
- Eventos WebSocket locales.
- Soporte de ejecucion Web POS.
- Soporte de ejecucion Desktop POS con Electron.
- Evaluacion futura de Capacitor/Android POS.

Historias de usuario incluidas:

- HU-01 Registrar terminal POS.
- HU-02 Configurar impresora termica.
- HU-03 Imprimir ticket de prueba.
- HU-04 Abrir caja registradora.
- HU-05 Leer peso desde balanza electronica.
- HU-06 Escanear QR o codigo de barras.
- HU-07 Simular perifericos sin hardware real.
- HU-08 Consultar estado de perifericos.
- HU-09 Ver logs tecnicos de perifericos.
- HU-10 Ejecutar Manus POS como aplicacion Desktop con Electron.
- HU-11 Evaluar ejecucion Android POS con Capacitor.

## Fuera de alcance

No incluye:

- Codigo funcional.
- Backend NestJS real.
- Frontend real.
- Migraciones.
- Drivers propietarios.
- Sincronizacion offline.
- Base local SQLite.
- Replica local PostgreSQL.
- Facturacion electronica offline.
- Android nativo.
- Empaquetado Electron real.
- Integracion con hardware real.
- Instalacion de dependencias.
- Modificacion de `api/`, `web/`, `database/` ni `backend-reporteria/`.

## Impacto esperado

| Area | Resultado esperado |
| --- | --- |
| Arquitectura | Backend API principal conserva reglas de negocio y no se acopla a hardware. |
| Operacion POS | Terminales podran usar perifericos locales en fases futuras. |
| QA | Modo simulador permitira pruebas sin dispositivos fisicos. |
| Desktop | Electron podra actuar como contenedor estable para caja fisica. |
| Android | Capacitor quedara evaluado con limites y riesgos documentados. |
| Soporte | Estados, logs y eventos facilitaran diagnostico. |

## Riesgos principales

| Riesgo | Mitigacion propuesta |
| --- | --- |
| Acoplar hardware al Backend API principal | Mantener `backend-perifericos` como dueno del hardware. |
| Exponer HTTP local a otros procesos no autorizados | Restringir bind local, token local, CORS local y limites de origen. |
| Variabilidad de drivers y dispositivos | Arrancar con `MOCK/SIMULATOR` y contratos estables. |
| Electron agrega complejidad de empaquetado | Diseñar por fases y dejar empaquetado fuera del alcance inicial. |
| Capacitor puede tener limites de USB/serial/HID | Tratar Android POS como evaluacion futura, no compromiso inicial. |
| Logs tecnicos pueden exponer datos sensibles | Sanitizar payloads y no registrar tickets completos por defecto. |
| Doble fuente de verdad entre API y agent | Backend API conserva negocio; agent conserva hardware y estado tecnico local. |

## Criterios generales de aceptacion de esta fase

1. Existen solo los artefactos OpenSpec solicitados para `add-pos-peripherals-platform`.
2. La especificacion valida con `openspec validate add-pos-peripherals-platform --type change --strict`.
3. No se implementa codigo funcional.
4. No se crean migraciones.
5. No se instalan dependencias.
6. No se modifican modulos existentes.
7. No se tocan `api/`, `web/`, `database/` ni `backend-reporteria/`.

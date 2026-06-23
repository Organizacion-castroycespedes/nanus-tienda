# Electron POS peripherals Windows

Fecha: 2026-06-20  
OpenSpec change: `analizar-perifericos-pos-electron-windows`

## Objetivo

Analizar la estrategia futura para integrar perifericos POS en Manus POS Electron Windows sin implementar acceso real a hardware en esta fase.

El objetivo tecnico es definir limites: que puede pedir la web, que debe validar `preload`, que debe ejecutar Electron `main`, y que debe seguir siendo autoridad del backend/API.

## Alcance

- Analizar perifericos POS Windows para clientes Tipo B y Tipo D.
- Definir enfoque inicial recomendado por periferico.
- Definir arquitectura futura Web/Electron/preload/main.
- Definir reglas de seguridad Electron para hardware.
- Definir configuracion futura por tenant, sucursal y terminal.
- Definir matriz inicial de compatibilidad.
- Definir criterios de QA hardware futuro.

## Fuera de alcance

- Implementar hardware real.
- Instalar SDKs de hardware.
- Instalar librerias de impresion, USB, serial o HID.
- Implementar comandos ESC/POS.
- Abrir puertos seriales, USB o red.
- Integrar bascula.
- Integrar gaveta.
- Integrar lector.
- Integrar impresora fiscal.
- Modificar POS.
- Modificar caja.
- Modificar pedidos.
- Modificar facturacion.
- Modificar backend.
- Modificar SQL/migraciones.
- Modificar permisos reales.
- Modificar logica de negocio.
- Implementar offline.
- Implementar sincronizacion.
- Modificar empaquetado funcional.

## Perifericos analizados

- Impresora termica/recibos.
- Gaveta monedera.
- Lector de codigo de barras.
- Bascula.
- Impresora fiscal como categoria futura/regulada.

Nota actual: el lector de codigo de barras HID ya tiene validacion documental propia en `pos-barcode-hid-electron.md`. Esa ruta sigue siendo teclado, no hardware nativo.

## Estrategia por periferico

### Impresora termica/recibos

Opciones analizadas:

| Opcion | Descripcion | Ventajas | Limitaciones |
| --- | --- | --- | --- |
| `window.print` desde web | La web usa dialogo normal del navegador/Electron renderer. | Simple, sin APIs nativas, usa impresoras Windows instaladas. | No es silencioso, depende de dialogo/UX, control limitado de papel. |
| `webContents.print` | Electron main imprime contenido renderizado. | Control Electron, puede elegir opciones futuras. | Requiere puente seguro desde renderer y QA por impresora. |
| Impresion silenciosa Electron | Electron imprime sin dialogo con impresora configurada. | Operacion rapida en caja. | Alto riesgo si se configura mal; requiere permiso/config explicita. |
| ESC/POS directo | Electron o agent manda comandos a impresora USB/serial/red. | Control de corte, cajon, formato ticket. | Requiere comandos, drivers, encoding y modelos certificados. |
| Impresora instalada en Windows | Usar cola de impresion del sistema. | Menos acoplamiento a hardware. | Drivers y tamanos de papel varian. |
| Renderer dedicado de ticket | Vista controlada para ticket. | Separacion visual de POS normal. | Todavia requiere decision de impresion. |

Recomendacion v0.0.1:

- Mantener impresion por flujo web/navegador o impresora Windows instalada como primer fallback.
- Preparar fase futura para `webContents.print` controlado por Electron.
- No implementar impresion silenciosa ni ESC/POS todavia.
- No duplicar logica de venta en plantillas Electron. El contenido imprimible debe derivar de datos ya autorizados por web/API.

Detalle posterior: la estrategia inicial de impresion web/Windows queda documentada en `electron-receipt-printing-windows.md`.

### Gaveta monedera

Opciones analizadas:

| Opcion | Descripcion | Estado recomendado |
| --- | --- | --- |
| Pulso ESC/POS por impresora termica | La gaveta se conecta a impresora y abre con comando de cajon. | Futura, despues de validar impresora. |
| Serial/USB directo | La gaveta tiene puerto propio o adaptador. | Futura, caso por caso. |
| Apertura manual | Usuario abre con llave/boton fisico. | Fallback inicial. |
| Apertura controlada por evento operativo | Electron abre despues de pago/caja valida. | Requerido para fase futura. |

Reglas:

- La web renderer no debe abrir gaveta directamente.
- No se debe exponer Node, serial, USB ni comandos ESC/POS al renderer.
- Un comando futuro de apertura debe pasar por preload con API estrecha.
- Main process o agent local debe validar configuracion de terminal y evento permitido.
- La apertura no crea venta ni cierra caja por si misma.

Recomendacion v0.0.1:

- Usar apertura manual o gaveta conectada a impresora solo sin integracion Manus.
- Documentar apertura Electron como fase futura despues de ventas/caja online validadas.

### Lector de codigo de barras

Opciones analizadas:

| Opcion | Descripcion | Estado recomendado |
| --- | --- | --- |
| Modo teclado HID | El lector escribe el codigo como teclado y manda Enter/tab. | Recomendado inicial. |
| USB/serial directo | Electron escucha dispositivo y parsea codigos. | Futura. |
| Input POS existente | El usuario enfoca busqueda/codigo y escanea. | Recomendado inicial. |
| API Electron de scanner | Preload expone eventos de scanner. | Futura si HID no basta. |

Recomendacion v0.0.1:

- Usar lectores en modo teclado HID.
- No requerir API Electron.
- Validar que el input actual del POS reciba codigo y confirme busqueda.
- Mantener configuracion de sufijo del lector, por ejemplo Enter, como tarea de soporte del hardware.

Riesgos:

- El foco del input puede estar en otro control.
- Algunos lectores agregan prefijos/sufijos.
- Codigos duplicados o no registrados siguen siendo responsabilidad de catalogo/productos.

### Bascula

Opciones analizadas:

| Opcion | Descripcion | Estado recomendado |
| --- | --- | --- |
| Lectura manual | Usuario escribe peso visible en bascula. | Fallback inicial. |
| Serial/USB con protocolo | Electron/agent lee tramas del dispositivo. | Futura. |
| API preload controlada | Renderer pide lectura actual o recibe evento validado. | Futura. |
| Integracion por proveedor | SDK o driver del fabricante. | Futura, caso por caso. |

Recomendacion v0.0.1:

- No alterar logica de productos pesables.
- Mantener lectura manual como fallback operativo.
- Investigar modelos/protocolos reales antes de disenar API.

Riesgos:

- Calibracion.
- Unidad de medida.
- Tara.
- Lectura inestable.
- Redondeo.
- Certificacion metrologica.
- Diferencias por fabricante.

### Impresora fiscal

La impresora fiscal se trata como categoria futura y regulada.

Consideraciones:

- Depende del pais.
- Depende del proveedor.
- Puede requerir SDK certificado.
- Puede requerir homologacion.
- Puede afectar facturacion electronica o fiscal.
- Puede exigir numeracion, consecutivos, autorizaciones y reportes regulatorios.

Decision:

- No entra en esta fase.
- No se simula cumplimiento fiscal.
- No se instala SDK fiscal.
- No se modifica facturacion.
- Debe abrirse como proyecto separado cuando exista pais/proveedor/regla fiscal concreta.

## Arquitectura recomendada

Arquitectura futura conceptual:

```text
Web renderer
  solicita accion local permitida
        |
        v
Electron preload
  expone API estrecha
  valida forma del payload
        |
        v
Electron main process
  ejecuta integracion local
  consulta configuracion terminal
  registra resultado tecnico
        |
        v
Periferico Windows
  impresora / gaveta / lector / bascula
```

Opcional futuro:

```text
Electron main process -> agent local controlado -> periferico
```

Ese agent podria ser util si se decide separar control de hardware de Electron, pero no se implementa en esta fase.

## Responsabilidades

| Capa | Debe hacer | No debe hacer |
| --- | --- | --- |
| Web renderer | Solicitar acciones permitidas y mostrar estado al usuario. | Acceder a Node, USB, serial, filesystem o comandos. |
| Preload | Exponer APIs especificas y validar payload basico. | Exponer Node completo o comandos genericos. |
| Main process | Ejecutar integracion local, manejar errores tecnicos y config local. | Implementar reglas complejas de negocio. |
| Backend/API | Autorizar ventas, caja, pedidos, facturacion y permisos. | Depender de hardware local para crear verdad de negocio. |
| Periferico | Ejecutar efecto fisico local. | Crear venta, abrir turno, facturar o cambiar stock por si solo. |

## Seguridad

Reglas minimas:

- Mantener `contextIsolation: true`.
- Mantener `nodeIntegration: false`.
- Mantener preload separado.
- No exponer Node completo al renderer.
- No permitir ejecucion arbitraria de comandos.
- No permitir rutas arbitrarias del sistema desde renderer.
- No permitir puertos arbitrarios desde renderer.
- Exponer solo APIs especificas, por ejemplo `printReceipt`, `openCashDrawer`, `readScale`.
- Validar payloads en preload y main.
- No imprimir silenciosamente sin configuracion explicita.
- No abrir gaveta sin evento operativo valido.
- No registrar datos sensibles en logs tecnicos.
- Rate limit futuro para comandos sensibles como abrir gaveta.
- Errores de hardware no deben mutar estado de negocio.

## Configuracion futura

Niveles posibles:

| Nivel | Uso futuro |
| --- | --- |
| Tenant | Politicas generales de perifericos permitidos. |
| Sucursal | Modelos comunes, impresoras por punto fisico. |
| Terminal | Impresora default, puerto, lector, bascula, gaveta. |
| Desarrollo | Variables de entorno para QA local controlada. |
| Archivo local | Configuracion offline de hardware sin ser datos operativos. |
| Backend futuro | Registro centralizado de terminales/perifericos autorizados. |

Variables futuras posibles para desarrollo:

- `MANUS_PRINTER_NAME`
- `MANUS_RECEIPT_PRINT_MODE`
- `MANUS_CASH_DRAWER_MODE`
- `MANUS_SCALE_PORT`
- `MANUS_SCANNER_MODE`

No se implementa persistencia local todavia.

## Matriz inicial de compatibilidad

| Periferico | Enfoque inicial recomendado | Requiere Electron | Requiere backend | Requiere configuracion terminal | Riesgo tecnico | Fase sugerida | Estado v0.0.1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lector codigo de barras | HID teclado sobre input POS | No inicialmente | No nuevo | Bajo, sufijo/foco | Bajo | Validacion POS online | Analizado, sin codigo |
| Impresora recibos | `window.print` o impresora Windows instalada; luego `webContents.print` | No para fallback, si para control Electron | No nuevo para imprimir copia autorizada | Medio | Medio | Impresion Electron controlada | Analizado, sin codigo |
| Gaveta monedera | Manual primero; pulso por impresora ESC/POS futuro | Si para apertura controlada | Posible para autorizacion/evento | Alto | Medio/alto | Despues de impresion | Analizado, sin codigo |
| Bascula | Lectura manual; serial/USB futuro | Si para lectura automatica | No nuevo al inicio, posible auditoria futura | Alto | Alto | Investigacion hardware | Analizado, sin codigo |
| Impresora fiscal | SDK/proveedor certificado futuro | Probable | Si, por facturacion/reglas | Alto | Alto/regulatorio | Proyecto fiscal separado | Fuera de alcance |

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Modelo de impresora no soporta comandos esperados | Tickets o gaveta fallan | Certificar modelos por Windows/driver. |
| Impresion silenciosa mal configurada | Tickets incorrectos o abuso | Requerir configuracion explicita por terminal. |
| Lector HID pierde foco | Escaneo va al campo equivocado | UX POS debe manejar foco y Enter en fase futura. |
| Bascula envia peso inestable | Venta con peso incorrecto | Requerir estabilidad y confirmacion antes de usar. |
| Fiscal mal implementado | Riesgo legal | Tratar fiscal como proyecto regulatorio separado. |
| Logs con datos sensibles | Riesgo privacidad | Logs tecnicos sin productos/clientes completos ni datos fiscales. |

## Decisiones

1. v0.0.1 recomienda lector de codigo de barras en modo HID teclado.
2. v0.0.1 no requiere API Electron para lector.
3. Impresion recibos debe empezar por rutas no invasivas: web/Windows print.
4. `webContents.print` es candidato siguiente para Windows.
5. ESC/POS directo queda futuro.
6. Gaveta no se abre desde renderer web sin control Electron/preload.
7. Bascula no altera productos pesables todavia.
8. Impresora fiscal queda fuera de alcance y depende de pais/proveedor.
9. Backend/API sigue siendo autoridad de negocio.
10. Hardware es efecto local controlado, no fuente de verdad operativa.

## Fases futuras

1. QA lector HID en POS online.
2. Diseno de ticket imprimible y fallback `window.print`.
3. Prueba `webContents.print` con impresora Windows instalada.
4. Configuracion local de impresora por terminal.
5. Impresion silenciosa controlada.
6. ESC/POS para impresora termica y corte.
7. Pulso de gaveta por impresora.
8. Investigacion bascula por modelos/protocolos.
9. API preload estrecha para bascula.
10. Investigacion fiscal por pais/proveedor.
11. Registro backend futuro de perifericos por terminal.
12. Dashboard QA/auditoria de hardware futuro.

## Criterios de QA hardware futuro

Para cada periferico real:

- Marca, modelo y firmware.
- Tipo de conexion: USB, serial, red, HID, driver Windows.
- Version Windows.
- Driver instalado.
- Terminal/sucursal/tenant de prueba.
- Configuracion usada.
- Comando ejecutado.
- Resultado esperado.
- Resultado real.
- Logs tecnicos sin datos sensibles.
- Evidencia visual o foto si aplica.
- Resultado: PASS, FAIL, BLOCKED o NOT_SUPPORTED.

No se debe marcar PASS de runtime de periferico sin ejecutar hardware real.

# Evidencia QA - Web NETWORK printer flag disabled - Fase 5.1

Fecha: 2026-06-04

## Objetivo

Actualizar la pantalla web de perifericos para registrar temporalmente una impresora `NETWORK` y validar que los adapters reales quedan bloqueados cuando `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.

## Alcance

Incluido:

- `web/domains/peripherals/`.
- `web/app/[tenant]/admin/peripherals/`.
- `docs/`.
- `openspec/changes/add-pos-peripherals-platform/tasks.md`.

Fuera de alcance confirmado:

- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No drivers.
- No USB.
- No serialport.
- No HID.
- No Electron.
- No Capacitor.
- No `api/`.
- No `database/`.
- No `backend-reporteria/`.
- No core de ventas, inventario, caja, compras ni facturacion.

## Ruta validada

```text
http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals
```

Resultado smoke:

```text
webRoute=200 length=8016
```

## Archivos modificados

- `web/domains/peripherals/types.ts`
- `web/domains/peripherals/api.ts`
- `web/domains/peripherals/components/PeripheralsPage.tsx`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-web-network-printer-flag-disabled-fase-5-1.md`

## Payload usado

```json
{
  "id": "network-printer-001",
  "type": "PRINTER",
  "name": "Impresora red ESC/POS",
  "status": "CONNECTED",
  "connectionType": "NETWORK",
  "terminalId": "local-terminal",
  "profileId": "THERMAL_80MM",
  "network": {
    "host": "192.168.1.50",
    "port": 9100,
    "timeoutMs": 3000
  }
}
```

## Resultado registro NETWORK

```text
networkRegister=201
id=network-printer-001
connectionType=NETWORK
host=192.168.1.50
port=9100
devicesAfter count=5
```

La UI ahora muestra:

- Badge `NETWORK`.
- `profileId`.
- `host:port` sin credenciales.

## Resultado test print con flag disabled

`PERIPHERALS_ENABLE_REAL_ADAPTERS=false` durante smoke.

```text
networkPrintDisabled=400
message=Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.
```

La UI muestra el error y el texto de seguridad:

```text
El adapter real esta desactivado por seguridad. Para pruebas reales debe habilitarse PERIPHERALS_ENABLE_REAL_ADAPTERS=true en backend-perifericos.
```

## Resultado MOCK sigue funcionando

```text
devicesBefore count=4
mockPrint=201
mode=MOCK
adapter=MockPrinterAdapter
previewLength=610
```

El handler de error conserva el ultimo `response.preview` cuando falla una prueba `NETWORK`.

## Resultado build web

Comando:

```text
cd web
npm.cmd run build
```

Resultado:

```text
PASS
```

Notas:

- Build compilo la ruta `/[tenant]/admin/peripherals`.
- Quedaron warnings existentes de hooks e imagenes en archivos no tocados por esta fase.
- `web/package.json` no tiene script `test`, por eso no se ejecuto `npm.cmd test`.

## Resultado backend-perifericos build/test

Comandos:

```text
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado:

```text
build PASS
test PASS - 33/33
```

## Resultado OpenSpec validate

Resultado:

```text
Change 'add-pos-peripherals-platform' is valid
```

## Resultado git diff --check

Resultado:

```text
PASS - exit 0
Nota: Git emitio warnings CRLF sobre archivos existentes fuera del alcance de Fase 5.1.
```

## Riesgos pendientes

- Smoke visual completo con navegador real queda pendiente si se requiere captura visual autenticada.
- La ruta puede requerir contexto de sesion real para validar sidebar/RBAC visual completo.
- `NETWORK` solo registra configuracion temporal en memoria del agent.
- La prueba real con impresora debe esperar aprobacion humana y flag explicito.

## Confirmacion no hardware real

Confirmado:

- No se habilito `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se intento socket real hacia `192.168.1.50`.
- No se conecto impresora fisica.
- No se instalo driver.
- No se agrego dependencia nueva.

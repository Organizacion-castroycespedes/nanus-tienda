# QA: soporte de cajon monedero via impresora XP-80 LAN

## Alcance de QA

- XP-80 LAN.
- Windows x64.
- Peripheral Agent local en `127.0.0.1:4050`.
- Drawer pulse via printer transport.
- Test manual de apertura.

## Reglas de certificacion

- No marcar hardware PASS desde `.14`.
- La QA fisica se ejecuta en workstation `.18`.
- No certificar si el response solo construye bytes.
- No certificar si el cajon se modela como TCP independiente.
- No certificar si el endpoint no reporta `bytesSent`.

## Secuencia fisica

1. Conectar el cajon al puerto drawer de la XP-80.
2. Verificar health del Agent.
3. Verificar que la XP-80 LAN sigue persistida.
4. Ejecutar `POST /cash-drawer/open`.
5. Confirmar `adapterName = NetworkEscposPrinterAdapter`.
6. Confirmar `bytesSent`.
7. Confirmar apertura fisica.
8. Repetir una segunda vez.
9. Confirmar un pulso por operacion.
10. Apagar y reiniciar el Agent.
11. Repetir sin reconfiguracion.
12. Probar impresion y corte.

## Evidencia esperada

- `success: true`
- `mode: REAL`
- `printerDeviceId = network-xp80-qa-001`
- `connectionType = NETWORK`
- `network.host = 192.168.123.100`
- `network.port = 9100`
- `bytesSent > 0`
- `pulse command/profile` visible en response o log tecnico

## Evidencia final registrada

- `CASH DRAWER PHYSICAL OPEN = PASS`
- `SECOND PHYSICAL OPEN = PASS`
- `1 REQUEST = 1 PHYSICAL OPEN = PASS`
- `REPEATED MANUAL OPEN = PASS`
- `NO DOUBLE PULSE = PASS`
- `NO AUTOMATIC RETRY OBSERVED = PASS`
- `NETWORK RUNTIME RECOVERY = PASS`
- `NOT_REACHABLE -> CONNECTED AFTER SUCCESS = PASS`
- `PERSISTED DEVICE CONFIGURATION = PASS`
- `XP-80 PRINT REGRESSION = PASS`
- `XP-80 PHYSICAL CUT REGRESSION = PASS`
- `PRINTER CORS PREFLIGHT = PASS`
- `CASH DRAWER CORS PREFLIGHT = PASS`
- `REMOTE WEB -> LOCAL AGENT = PASS`
- `NO CORS WILDCARD = PASS`
- `MANUS SALE -> PRINT TICKET = PASS`
- `MANUS SALE -> PHYSICAL CUT = PASS`
- `MANUS SALE -> CASH DRAWER OPEN = PASS`
- `BROWSER -> LOCAL AGENT = PASS`
- `XP-80 LAN PRINT = PASS`
- `XP-80 LAN CASH DRAWER = PASS`

## Criterio final

Solo despues de la secuencia completa:

```text
XP-80 LAN CASH DRAWER = HARDWARE CERTIFIED
```

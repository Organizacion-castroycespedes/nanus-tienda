# Evidencia: remediación de seguridad de release `0.0.1`

## Alcance

- Rama: `develop`.
- HEAD antes: `ca02af6`.
- No hubo llamadas a FactuCore o DIAN, cambios de QA, push ni deploy.
- La certificación E2E electrónica previa sigue válida: `SETP990000007` fue aceptado por DIAN, FactuCore y Manus.

## Archivos clasificados

- Cuatro dumps PostgreSQL QA bajo `scripts/database/backups/`: artefactos de datos sensibles, no requeridos por runtime, build ni tests.
- `scripts/config/db.env`: configuración con material de credenciales QA y datos de conexión; no es seguro rastrearla.
- `backend-facturacion-electronica/FactuCore/certificado.p12`: material PKCS#12 relacionado con FactuCore/DIAN; se trata como material privado no rastreable.

Los archivos locales siguen preservados y no se imprimieron sus contenidos. El certificado fue reconocido estructuralmente como PKCS#12. La presencia histórica de credenciales y material PKCS#12 requiere rotación/revocación según el dueño de QA; no se ejecutó rotación.

## Cambios

- Se quitaron del índice todos los dumps `*.dump`, `scripts/config/db.env` y `*.p12`.
- Se añadieron reglas seguras a `.gitignore` para dumps, configuración local y PKCS#12/PFX.
- Se creó `scripts/config/db.env.example` con placeholders falsos.
- No se reescribió el historial. Los archivos siguen expuestos en commits históricos remotos y requieren evaluación de purge posterior.

## Validación

- Billing: `143/143 PASS`.
- API: `565 PASS`, `1 skipped`, `0 fail`.
- Electron: `33/33 PASS`.
- API, Billing y Web build: PASS.
- Configuración de certificado: PASS estructural; usa ruta/password externas (`DIAN_CERT_PATH`/`DIAN_CERT_PASSWORD`).
- OpenSpec Billing: PASS.
- OpenSpec all: `86 passed, 1 failed`; fallo heredado en `corregir-handoff-agent-local-perifericos-electron`.
- `git diff --check`: PASS.

## Decisión

- Seguridad del árbol actual: PASS después de este commit.
- Historial: exposición remota histórica confirmada; rotación de credenciales/certificado requerida antes de release.
- Gate `0.0.1`: `BLOCKED_SECURITY_ROTATION`.
- No promover a `release/evolutivo/0.0.1` hasta completar rotación y revisión de historial.
- Workers globales de Manus y FactuCore siguen deshabilitados.


# Evidencia QA Electron Packaged Login

- Fecha: 2026-06-21
- Rama: `feat/0.0.1/arquitectura-clientes-web-electron`
- HEAD inicial: `ba9fbf9`
- HEAD probado: `2fe3cdf`
- Estado del worktree: sucio, cambios locales sin commit en `web/.env.example` y `web/next.config.mjs`

## Contexto

Se preparo una ruta segura de QA para el login empaquetado de Electron sin crear un bypass universal ni tocar la autenticacion productiva.

## Entorno probado

- Web QA local: `http://localhost:3001`
- Ruta: `/login`
- Electron empaquetado: `desktop/electron/release/win-unpacked/Manus POS.exe`
- Flag QA local: `NEXT_PUBLIC_QA_LOGIN_ENABLED=true`

## Comandos ejecutados

- `npm.cmd run dev`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3001/login`
- `Start-Process` para abrir Electron empaquetado
- `chrome.exe --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom http://localhost:3001/login`

## Resultado observado

- La pagina de login carga en Electron empaquetado.
- El checkbox de human-check no aparece en la ruta QA local.
- El DOM en la web QA local ya no muestra el texto del captcha.
- La sesion activa previa se cierra con `Cerrar la otra sesion`.
- Electron llega al dashboard de `/{tenant}/dashboard` con usuario QA.

## Resultado final

`PASS_QA_MANUAL_LOGIN_PATH`

## Riesgos y notas

- La ruta QA solo vale en localhost y con `NEXT_PUBLIC_QA_LOGIN_ENABLED=true`.
- No se toco backend, SQL, permisos ni logica de negocio.
- No se introdujo bypass universal.
- El siguiente bloqueo de scanner ya no es login. Es ausencia de caja abierta para el alcance POS actual.

## Evidencia visual

- `C:\Users\Profe\AppData\Local\Temp\electron-qa-login.png`
- `C:\Users\Profe\AppData\Local\Temp\electron-qa-after-login.png`
- `C:\Users\Profe\AppData\Local\Temp\electron-qa-after-login-2.png`
- `C:\Users\Profe\AppData\Local\Temp\electron-qa-after-submit.png`

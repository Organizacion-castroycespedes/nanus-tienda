# Electron Packaged QA Login

## Objetivo

Resolver el bloqueo de QA manual en Electron empaquetado sin debilitar la autenticación productiva.

## Problema observado

La ventana Electron empaquetada abre el login web, pero el flujo manual de human-check bloquea el ingreso antes de llegar al POS.

## Causa probable

El bloqueo no está en el backend. El login real y la API `POST /auth/login` responden. El bloqueo está en la validación visual del formulario de login.

## Solución elegida

Usar un flag explícito de QA local:

- `NEXT_PUBLIC_QA_LOGIN_ENABLED=true`

El flag solo vale en hostnames locales como:

- `localhost`
- `127.0.0.1`
- `::1`

Así se mantiene la autenticación normal fuera de QA local.

## Alternativas evaluadas

- Bypass universal de login. Rechazado.
- Desactivar reCAPTCHA en producción. Rechazado.
- Hardcodear credenciales. Rechazado.
- Token manual en código. Rechazado.
- Cambio backend para saltar auth. Rechazado por alcance.

## Variables de entorno necesarias

- `NEXT_PUBLIC_QA_LOGIN_ENABLED=true`
- `NEXT_PUBLIC_API_BASE_URL`
- `MANUS_WEB_URL`
- `MANUS_START_PATH`

## Riesgos

- El flag no debe quedar habilitado en builds de producción.
- El guard de hostname debe seguir activo.
- El QA login no cambia la sesión ni la autoridad del backend.

## Qué no se permite

- Bypass universal.
- Tokens o credenciales en repo.
- Desactivar protección en producción.
- Cambiar permisos, SQL, caja, pedidos, facturación o reglas de negocio.

## Cómo repetir QA

1. Levantar la web local.
2. Arrancar Electron empaquetado contra la web local.
3. Abrir `/login`.
4. Confirmar que el login avanza con la configuración QA local.
5. Llegar al POS y luego repetir el flujo HID del scanner.

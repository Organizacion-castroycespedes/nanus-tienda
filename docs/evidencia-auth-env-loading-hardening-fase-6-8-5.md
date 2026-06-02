# Evidencia auth env loading hardening Fase 6.8.5

Fecha: 2026-06-02

## Alcance

- Revisado `api/src/main.ts`, `api/src/modules/app.module.ts`, `AuthModule`, `AuthService`, `JwtAuthGuard`, `MenuService` y `MenuController`.
- No se reviso ni modifico pricing, POS, Orders, SQL, frontend, facturacion electronica, DIAN ni suppliers.
- No se imprimieron ni documentaron valores de `JWT_SECRET`.

## Hallazgos

1. `main.ts` ejecutaba `dotenv.config()` dentro de `bootstrap()`.
2. `AppModule` se importaba de forma estatica antes de entrar a `bootstrap()`.
3. `AuthService`, `JwtAuthGuard`, `MenuService` y `MenuController` leian `process.env.JWT_SECRET` en constantes de modulo.
4. Si esos modulos se evaluaban antes de cargar `.env`, el secreto quedaba fijado con fallback `"changeme"`.

## Hardening aplicado

1. Se agrego `api/src/common/config/env.ts` para cargar `.env` desde `cwd` y desde la raiz de `api/`.
2. Se agrego `api/src/common/config/auth-env.ts` para centralizar resolucion de:
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `REFRESH_TOKEN_EXPIRES_DAYS`
3. `main.ts` ahora ejecuta `loadApiEnv()` y `assertAuthEnv()` antes de importar dinamicamente `AppModule`.
4. `AuthService`, `JwtAuthGuard`, `MenuService` y `MenuController` ya no capturan `JWT_SECRET` al cargar modulo.
5. El fallback inseguro solo queda permitido cuando `NODE_ENV` es explicitamente `local` o `test`.
6. En otros entornos, si falta `JWT_SECRET`, el bootstrap de API falla antes de crear servicios o guards.

## Prueba agregada

- `api/src/common/config/auth-env.spec.ts`

Cobertura:

- Usa `JWT_SECRET` configurado.
- Rechaza fallback fuera de `NODE_ENV=local` o `NODE_ENV=test`.
- Mantiene fallback local/test explicito.
- Mantiene defaults compatibles para duracion de access token y refresh token.

## Validaciones ejecutadas

- `cd api && npm.cmd run build`: pass.
- `cd api && npx.cmd tsx --test src/common/config/auth-env.spec.ts`: pass, 4 tests.
- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`: pass, 1/1 valid.
- `git diff --check`: pass. Git mostro advertencias CRLF/LF, sin errores de whitespace.

## Restricciones confirmadas

- No se toco pricing.
- No se toco POS.
- No se toco Orders.
- No se toco `inventory_create_sale_v2`.
- No se toco SQL.
- No se toco frontend.
- No se toco facturacion electronica.
- No se toco DIAN.
- No se toco suppliers.
- No se toco PRD real.
- No se ejecuto remoto.
- No se hizo commit.
- No se guardo ningun valor real de `JWT_SECRET`.

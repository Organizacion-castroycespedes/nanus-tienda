# Evidencia QA - Branding y menu multitenant UX

## Datos base

- Rama usada: `feat/develop/mejora-experiencia-visual-menu`
- Ruta probada: `/00000000-0000-0000-0000-000000000001/configuracion`
- URL local: `http://localhost:3000/00000000-0000-0000-0000-000000000001/configuracion`
- Navegador/dispositivo usado: intento con Browser in-app en escritorio; bloqueado por runtime local (`windows sandbox failed: spawn setup refresh`).
- Tenant probado: `00000000-0000-0000-0000-000000000001`

## Branding inicial cargado

- QA tecnico confirma que la vista usa `getTenantConfig(selectedTenantId)` para super admin y Redux branding para tenant actual.
- Al cambiar tenant, el formulario se reinicia a defaults seguros antes de aplicar la respuesta del tenant nuevo.
- HTTP check local despues del refinamiento: bloqueado por estado local de servidores Next ya abiertos. `localhost:3000` responde 500 por chunk stale `./1554.js`; `localhost:3002` desde `next start` responde 500 por chunk faltante `./vendor-chunks/@reduxjs.js`. `npm run build` si compila correctamente la ruta.

## Colores cargados

- Los campos soportan:
  - `Color primario *`
  - `Color secundario`
  - `Color fondo`
  - `Color texto`
- Cada campo renderiza swatch, selector `type=color`, valor hex editable y mensaje por campo invalido.
- Valores invalidos usan swatch fallback seguro y bloquean guardado.

## Evidencia swatch + hex

- Implementado en `web/components/design-system/ColorField.tsx`.
- El swatch usa el hex normalizado si es valido.
- El input de texto muestra el valor hexadecimal editable.
- `#RGB` se normaliza a `#RRGGBB` al perder foco.
- El campo sigue el patron base de `Input.tsx`: label superior, `rounded-lg`, `border-slate-200`, `bg-white`, `shadow-sm` y focus ring azul.

## Evidencia vista previa en tiempo real

- La vista previa usa estado local `brandingForm`, no espera guardado.
- `previewTheme` se construye con `buildTenantThemeTokens(normalizedBrandingConfig)`.
- `BrandingThemePreview` recibe `TenantThemeTokens` ya resueltos; no reconstruye colores con otro algoritmo.
- Actualiza color primario, secundario, fondo, texto, tipografia y logo.
- Incluye empresa real si existe; fallback: `Manus Tienda Platform S.A.S.`
- La vista previa ahora vive en `web/app/[tenant]/configuracion/components/BrandingThemePreview.tsx`.
- Usa un mini dashboard con superficie neutra, mini sidebar, header, cards internas, boton primario, boton secundario, badge activo, item de menu activo y submenu activo.
- El mini sidebar usa `getMenuItemStateStyles(theme, state)`, el mismo helper que usa el sidebar real.
- Los colores del tenant se usan como acentos, estados y bordes suaves; no como fondo masivo de toda la preview.

## Evidencia de guardado

- Guardado usa `updateTenantConfig(selectedTenantId, normalizedBrandingConfig)`.
- Branding invalido se bloquea antes de llamar API.
- Si la API devuelve `config`, el formulario se rehidrata desde esa respuesta.
- Si la API devuelve respuesta parcial, se conserva `normalizedBrandingConfig` como fuente segura.
- Si se guarda el tenant actual, Redux se actualiza inmediatamente con `savedBranding` normalizado.
- Si super admin edita otro tenant, no se aplica accidentalmente al layout actual.

## Evidencia menu activo/submenu activo

- `getMenuItemStateStyles(themeTokens, state)` centraliza fondo, texto, icono, indicador y chevron.
- Sidebar real usa el helper para opcion activa, padre activo y submenu activo.
- Preview usa el mismo helper y los mismos `theme.menu.*` tokens que el sidebar real.
- Focus usa tokens `--brand-sidebar-focus` y `--brand-sidebar-focus-offset`.
- `buildTenantThemeTokens` ahora expone tokens suaves: `primarySoftBg`, `primaryBorder`, `secondarySoftBg`, `secondaryBorder`, `appBackground` y `menu.*`.
- Fondos fuertes del tenant caen a superficies seguras del sistema para evitar saturacion visual.
- Si el menu es oscuro, activo/submenu usan acento visible y texto claro calculado.
- Si el menu es blanco o muy claro, activo/submenu no quedan blancos: usan tintes derivados del primario/secundario con texto de contraste.
- Si el primario es demasiado claro, neon o amarillo, el activo usa fallback seguro `#2563EB`.
- Bordes de sidebar y separadores de seccion usan `tenantTheme.sidebar.border`; no quedan hardcodeados a blanco.

## Validaciones tecnicas de contraste

- Tests cubren colores invalidos, normalizacion, fallback de background fuerte y contraste.
- Tests cubren menu oscuro, menu blanco, menu `#F8FAFC`, primario demasiado claro y submenu activo.
- Tests cubren que activo/submenu no usen el mismo fondo que el menu cuando el fondo es claro.
- Tests cubren que el contraste activo llegue a `>= 4.5` donde el color es hexadecimal calculable.

## Fix final contraste menu/submenu activo

- Problema QA: la preview mostraba `Menu visual` claro y legible, pero el submenu real `Terminales` se veia opaco.
- Causa tecnica: `menuSubActiveBg` usaba `color-mix(in srgb, ${menuAccent} 36%, ${menuBackground})`, que podia producir rojo/marron oscuro contra sidebar navy.
- Causa de aplicacion real: el bullet del submenu real usaba `bg-current opacity-70` en vez de `menuItemStyles.icon`; la preview si usaba el helper.
- Correccion: `buildTenantThemeTokens` ahora genera `menu.subActiveBg`, `menu.subActiveText` y `menu.subActiveIndicator` finales como hex contrastados.
- Correccion: el submenu real ahora usa `getMenuItemStateStyles` para fondo, texto, indicador lateral y bullet.
- Correccion: el contenedor de submenu real tiene `rounded-lg`, asi el fondo activo se ve como superficie seleccionada y no como mancha plana.
- Correccion: se reemplazo `hover:bg-black/10` del boton de chevron activo por `hover:bg-[var(--brand-sidebar-hover)]`.

### Colores usados en pruebas tecnicas

- Sidebar oscuro + primary fuerte: `primary #DC2626`, `secondary #0F172A`.
- Sidebar claro/blanco: `primary #2563EB`, `secondary #FFFFFF`.
- Sidebar claro suave: `primary #1D4ED8`, `secondary #F8FAFC`.
- Primary claro: `primary #FEF3C7`, `secondary #111827`.
- Primary oscuro: `primary #020617`, `secondary #111827`.
- Secondary parecido al background: `primary #2563EB`, `secondary #F8FAFC`.

### Preview comparada con menu real

- Preview y sidebar real consumen el mismo contrato `TenantThemeTokens`.
- Preview llama `getMenuItemStateStyles(theme, state)`.
- Sidebar real llama `getMenuItemStateStyles(tenantTheme, state)`.
- `theme.menu.subActiveBg` coincide con `theme.sidebar.subItemActiveBackground`.
- `theme.menu.subActiveText` coincide con `theme.sidebar.subItemActiveText`.
- `theme.menu.subActiveIndicator` coincide con `theme.sidebar.subItemActiveIndicator`.
- No hay calculo de color de menu dentro de `BrandingThemePreview`.

### Estado visual esperado despues del fix

- Menu principal activo: fondo fuerte visible, texto contrastado, icono legible, indicador solido.
- Submenu activo: fondo visible pero menor jerarquia que el padre, texto legible, indicador/bullet solido.
- Sidebar oscuro: submenu activo usa superficie oscura aclarada, no rojo/marron apagado.
- Sidebar claro/blanco: submenu activo usa tinte visible, no blanco sobre blanco.
- Hover: queda mas suave que active.
- Focus: conserva ring visible desde `theme.sidebar.focusRing`.

## Ajuste final submenú activo sin contorno completo

- Problema QA: `Terminales` ya no se perdia, pero parecia outline/error por un contorno rojo completo.
- Causa tecnica: el estado activo de subitem usaba `boxShadow: inset 0 0 0 1px ${themeTokens.menu.subActiveIndicator}`.
- Correccion: el subitem activo ahora usa `boxShadow: none`; el foco visible queda reservado al `focus-visible:ring`.
- Correccion: `menuSubActiveBg` en sidebar oscuro sube a una superficie aclarada mas visible (`lighten(menuBackground, 0.3/0.36/0.42)`).
- Resultado esperado: seleccion por fondo + indicador lateral + bullet activo, no por contorno completo.
- Jerarquia: el submenú activo queda mas suave que el menu padre activo, pero mas evidente que hover.
- Coherencia: preview y sidebar real siguen usando `getMenuItemStateStyles` y los mismos tokens `theme.menu.*`.
- Tests agregan guard contra regresion: `submenu.container.boxShadow === "none"` y contraste minimo de fondo submenu contra menu.

## Fix jerarquia real submenu activo promovido

- Problema QA: en `Configuracion > Terminales`, el padre `Configuracion` se veia contextual/suave, pero `Terminales` seguia gris/suave.
- Causa tecnica: el helper solo distinguia activo y submenu activo suave; no tenia estado explicito para `parent open with active child` ni para `child active promoted`.
- Correccion helper: `getMenuItemStateStyles` ahora acepta `isOpen` y `promoteActive`.
- Estado `parent active`: `depth: 0`, `isActive: true`, `hasActiveChild: false`; usa `menu.activeBg`, `menu.activeText`, `menu.activeIndicator`.
- Estado `parent open/contextual`: `depth: 0`, `isOpen: true`, `hasActiveChild: true`; usa `menu.openBg`, `menu.openText`, `menu.openIndicator`.
- Estado `child active promoted`: `depth: 1`, `isActive: true`, `promoteActive: true`; usa `menu.activeBg`, `menu.activeText`, `menu.activeIndicator`.
- Sidebar real: el padre con hijo activo se llama con `isOpen: true` y `hasActiveChild: true`.
- Sidebar real: el hijo activo se llama con `promoteActive: true`.
- Preview: muestra la misma jerarquia: `Configuracion` contextual/open y `Menu visual` promoted/fuerte.
- Rutas QA esperadas:
  - Configuracion principal: `Configuracion` puede verse fuerte.
  - Configuracion > Usuarios: `Configuracion` contextual y `Usuarios` fuerte.
  - Configuracion > Perifericos POS: `Configuracion` contextual y `Perifericos POS` fuerte.
  - Configuracion > Terminales: `Configuracion` contextual y `Terminales` fuerte.
- Tests agregados: parent active strong, parent open contextual, child active promoted, child promoted en sidebar claro, contrato preview/sidebar con tokens open.

### Captura / navegador

- Browser in-app: bloqueado por runtime local con `windows sandbox failed: spawn setup refresh`.
- QA visual manual: ejecutado por el usuario en navegador local con captura.
- Ruta validada:
  - `/00000000-0000-0000-0000-000000000001/configuracion`
  - `/00000000-0000-0000-0000-000000000001/configuracion/terminales`
- Resultado visual final: PASS.

Validación observada:
- En configuración principal, `Configuracion` mantiene énfasis principal cuando no hay submenú activo.
- En `Configuracion > Terminales`, el padre `Configuracion` queda como contexto abierto/suave.
- En `Configuracion > Terminales`, el submenú `Terminales` queda promovido como activo fuerte/principal.
- El submenú activo ya no se ve opaco, gris ni apagado.
- El submenú activo tiene mayor protagonismo visual que el padre contextual.
- El contraste es legible sobre sidebar oscuro.
- La jerarquía visual queda correcta:
  - Padre = contexto.
  - Hijo activo = ubicación actual.

## Validacion responsive basica

- Build Next.js pasa para rutas app, incluyendo `/[tenant]/configuracion`.
- QA visual manual ejecutado en navegador local de escritorio.
- No se ejecutó inspección responsive completa por Browser in-app debido al fallo del runtime local.
- Resultado responsive: no aplica como PASS responsive completo; sin regresión visual evidente en escritorio.

## Validaciones ejecutadas

- `npx.cmd tsx --test src\lib\theme\colors.spec.ts src\lib\theme\buildTenantTheme.spec.ts`: PASS, 20/20.
- `npm.cmd run lint`: PASS con warnings preexistentes de hooks e imagenes.
- `npm.cmd run build`: PASS con warnings preexistentes de hooks, imagenes y Browserslist.
- `openspec.cmd validate mejorar-ux-branding-menu-multitenant --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 23/23.
- `git diff --check`: PASS con warnings CRLF de Git.

## Resultado

- PASS tecnico.
- PASS QA visual manual.
- QA visual validado por el usuario en navegador local mediante captura.
- Browser in-app no ejecutado por bloqueo del runtime local, pero no bloquea el cierre porque la validación visual manual fue realizada externamente.

## Estado final

- Rama: `feat/develop/mejora-experiencia-visual-menu`
- OpenSpec: `mejorar-ux-branding-menu-multitenant`
- Estado OpenSpec: tareas completas.
- Backend tocado: NO
- Frontend tocado: SI
- SQL tocado: NO
- DB QA tocada: NO
- Permisos/guards tocados: NO
- Contratos API tocados: NO
- Produccion tocada: NO
- Deploy: NO
- Push: NO
- Merge: NO
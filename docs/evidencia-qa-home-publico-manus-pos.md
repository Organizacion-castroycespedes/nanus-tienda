# Evidencia QA Home publico Manus POS

Fecha: 2026-06-18
Rama: `feat/0.0.1/mejora-ux-home`
Change OpenSpec: `redisenar-home-publico-manus-pos`
Ruta afectada: `/`

## Cierre formal de fase

| Item | Estado |
| --- | --- |
| Estado QA manual | PASS |
| Responsable QA manual | QA manual reportado por usuario |
| Ruta probada | `http://localhost:3000/` |
| Rama probada | `feat/0.0.1/mejora-ux-home` |
| Alcance | Home publico Manus POS en `/` |
| Dashboard interno | No tocado |
| Backend / SQL / permisos / guards | No tocado |
| Logica de negocio | No tocada |

Secciones revisadas:

- Header/nav.
- Hero / presentacion principal.
- Funcionalidades.
- Beneficios.
- Como funciona.
- Para quien sirve.
- CTA final.
- Login / CTA solicitar demo, segun flujo publico visible.

Confirmacion visual:

- Imagenes del Home publico cargan correctamente segun QA manual.
- Layout desktop OK segun QA manual.
- No hay ruptura visual evidente segun QA manual.
- Responsive/mobile: no se recibio evidencia tecnica adicional; queda como QA manual reportado por usuario.

Confirmacion de alcance:

- No dashboard interno `/:tenantId/dashboard`.
- No backend.
- No SQL.
- No permisos.
- No guards.
- No logica de negocio.
- No Electron.
- No Capacitor.
- No perifericos.
- No facturacion electronica.
- No CRM.

## Objetivo

Redisenar el Home publico de Manus POS para comunicar con mas fuerza ventas, inventario, caja, pedidos y reportes, usando el asset comercial:

```text
/images/home/manus-pos-hero-landing.png
```

## Discovery

| Comando | Resultado |
| --- | --- |
| `git rev-parse --abbrev-ref HEAD` | `feat/0.0.1/mejora-ux-home` |
| `git rev-parse --short HEAD` | `ac66061` |
| `openspec.cmd validate --all --strict` inicial | PASS, 25 passed |
| `git status --short` inicial | `?? web/public/images/` |

Nota: `web/public/images/home/manus-pos-hero-landing.png` estaba no trackeado al inicio y se uso como asset del cambio.

## Alcance implementado

- Hero publico con headline requerido.
- Subheadline requerido.
- CTA principal `Solicitar demo`.
- CTA secundario `Ver funcionalidades`.
- Chips: POS, Inventario, Caja, Pedidos, Reportes.
- Funcionalidades principales:
  - Punto de venta
  - Inventario
  - Caja y finanzas
  - Pedidos
  - Compras
  - Clientes
  - Reportes
  - Configuracion
- Beneficios:
  - Mas control
  - Menos errores
  - Operacion mas rapida
  - Informacion en tiempo real
  - Acceso desde cualquier lugar
- Showcase visual:
  - POS
  - Inventario
  - Caja
  - Pedidos / clientes
  - Reportes
- Como funciona:
  - Configura tu negocio
  - Registra productos y clientes
  - Vende desde el POS
  - Controla caja e inventario
  - Consulta reportes
- CTA final comercial.

## Actualizacion de imagenes de funcionalidades

Se actualizaron las cards de la seccion `Todo lo que necesita una tienda para vender y operar mejor` para usar imagenes reales desde `web/public/images/features/`.

| Card | Ruta publica usada |
| --- | --- |
| Punto de venta | `/images/features/punto_ventas.png` |
| Inventario | `/images/features/inventario.png` |
| Caja y finanzas | `/images/features/caja-finanzas.png` |
| Pedidos | `/images/features/pedidos.png` |
| Compras | `/images/features/compras.png` |
| Clientes | `/images/features/clientes.png` |
| Reportes | `/images/features/reportes.png` |
| Configuracion | `/images/features/configuracion.png` |

Renombres aplicados:

- `web/public/images/features/caja- finanzas.png` -> `web/public/images/features/caja-finanzas.png`
- `web/public/images/features/punto-ventas.png` -> `web/public/images/features/punto_ventas.png`

Nota: durante discovery, el archivo de caja aparecio como `caja- finanzas.png`; se normalizo al nombre solicitado sin espacio. Tambien se normalizo `punto-ventas.png` para cumplir el mapping requerido `/images/features/punto_ventas.png`.

## Actualizacion de imagenes de beneficios

Se actualizaron las cards de la seccion `Beneficios` para reemplazar iconos simples por imagenes generadas desde `web/public/images/benefits/`.

| Beneficio | Ruta publica usada |
| --- | --- |
| Mas control | `/images/benefits/mas-control.png` |
| Menos errores | `/images/benefits/menos-errores.png` |
| Operacion mas rapida | `/images/benefits/operacion-rapida.png` |
| Informacion en tiempo real | `/images/benefits/informacion-tiempo-real.png` |
| Acceso desde cualquier lugar | `/images/benefits/acceso-cualquier-lugar.png` |

Renombre aplicado:

- `web/public/images/benefits/menus-error.png` -> `web/public/images/benefits/menos-errores.png`

Nota: las imagenes ya estaban disponibles en `web/public/images/benefits/`; se normalizo el nombre de `menos-errores.png` para cumplir kebab-case ASCII.

## Actualizacion de imagenes de Para quien sirve

Se actualizaron las cards de la seccion `Para quien sirve` para reemplazar iconos simples por imagenes modernas desde `web/public/images/audience/`.

| Card | Ruta publica usada |
| --- | --- |
| Tiendas de barrio | `/images/audience/tiendas-barrio.png` |
| Minimarkets | `/images/audience/minimarkets.png` |
| Retail pequeno | `/images/audience/retail-pequeno.png` |
| Negocios con inventario | `/images/audience/negocios-inventario.png` |

Estado de assets:

- `web/public/images/audience/tiendas-barrio.png`
- `web/public/images/audience/minimarkets.png`
- `web/public/images/audience/retail-pequeno.png`
- `web/public/images/audience/negocios-inventario.png`

Nota: las rutas fuente `/mnt/data/*.png` no estuvieron disponibles desde PowerShell. Los cuatro assets ya estaban disponibles con nombres normalizados en `web/public/images/audience/` y se usaron como fuente final.

## Actualizacion de Como funciona

Se reemplazaron las 5 cards paso a paso de la seccion `Como funciona` por una imagen profesional que resume el flujo operativo completo.

| Elemento | Estado |
| --- | --- |
| Asset publico | `/images/home/flows/flujo-operacion-pos.png` |
| Archivo destino | `web/public/images/home/flows/flujo-operacion-pos.png` |
| Cards paso a paso | Eliminadas de la seccion principal |
| Desktop | Imagen centrada, `object-contain`, ancho maximo controlado |
| Mobile | Contenedor con `overflow-x-auto` y ancho minimo para mantener legibilidad |

Nota: la ruta fuente `/mnt/data/flujo_de_operación_pos_simplificado.png` no estuvo disponible desde PowerShell. Se uso el asset equivalente ya presente en `web/public/images/flows/flujo-operacion-pos.png` como fuente local para copiarlo al destino requerido.

## Archivos publicos modificados

- `web/app/page.tsx`
- `web/components/landing/Navbar.tsx`
- `web/components/landing/Hero.tsx`
- `web/components/landing/Features.tsx`
- `web/components/landing/Benefits.tsx`
- `web/components/landing/FeatureShowcase.tsx`
- `web/components/landing/HowItWorks.tsx`
- `web/components/landing/IdealFor.tsx`
- `web/components/landing/CTA.tsx`
- `web/components/landing/Footer.tsx`

## Assets publicos usados

Hero y logo:

- `web/public/images/home/manus-pos-hero-landing.png`
- `web/public/LogoManus.png.jpeg`

Funcionalidades:

- `web/public/images/features/punto_ventas.png`
- `web/public/images/features/inventario.png`
- `web/public/images/features/caja-finanzas.png`
- `web/public/images/features/pedidos.png`
- `web/public/images/features/compras.png`
- `web/public/images/features/clientes.png`
- `web/public/images/features/reportes.png`
- `web/public/images/features/configuracion.png`

Beneficios:

- `web/public/images/benefits/mas-control.png`
- `web/public/images/benefits/menos-errores.png`
- `web/public/images/benefits/operacion-rapida.png`
- `web/public/images/benefits/informacion-tiempo-real.png`
- `web/public/images/benefits/acceso-cualquier-lugar.png`

Como funciona:

- `web/public/images/home/flows/flujo-operacion-pos.png`

Para quien sirve:

- `web/public/images/audience/tiendas-barrio.png`
- `web/public/images/audience/minimarkets.png`
- `web/public/images/audience/retail-pequeno.png`
- `web/public/images/audience/negocios-inventario.png`

Assets detectados no usados por el Home publico actual:

- `web/public/LogoManusBlanco.png.png`
- `web/public/images/flows/flujo-operacion-pos.png`

## Guardrails

| Area | Estado |
| --- | --- |
| Backend | No tocado |
| SQL | No tocado |
| Permisos | No tocado |
| Guards | No tocado |
| Dashboard interno `/:tenantId/dashboard` | No tocado |
| Rutas internas tenant | No tocadas |
| Electron | No tocado |
| Capacitor | No tocado |
| Perifericos | No tocado |
| Facturacion electronica | No tocada |
| CRM | No tocado |
| Dependencias nuevas | Ninguna |

## Validaciones

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| Browser interno `http://localhost:3000/` | FAIL/BLOCKED: herramienta Browser fallo dos veces por sandbox `spawn setup refresh` |
| `Invoke-WebRequest http://localhost:3000/` | PASS, HTTP 200 |
| Verificacion SSR de textos/asset requeridos | PASS |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |

## Validaciones posteriores a imagenes de funcionalidades

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |
| Browser interno `http://localhost:3000/` | FAIL/BLOCKED: herramienta Browser fallo por sandbox `spawn setup refresh` |
| `Invoke-WebRequest http://localhost:3000/` | PASS, HTTP 200 |
| Verificacion SSR de rutas `/images/benefits/*` | PASS, 5 rutas encontradas |
| Verificacion SSR de typo anterior | PASS, `menus-error.png` no aparece |
| Browser interno `http://localhost:3000/` | FAIL/BLOCKED: herramienta Browser fallo por sandbox `spawn setup refresh` |
| `Invoke-WebRequest http://localhost:3000/` | PASS, HTTP 200 |
| Verificacion SSR de `/images/home/flows/flujo-operacion-pos.png` | PASS |
| Verificacion SSR de cards antiguas | PASS, `Configura tu negocio` no aparece en HTML |
| Browser interno `http://localhost:3000/` | FAIL/BLOCKED: herramienta Browser fallo por sandbox `spawn setup refresh` |
| `Invoke-WebRequest http://localhost:3000/` | PASS, HTTP 200 |
| Verificacion SSR de rutas `/images/features/*` | PASS, 8 rutas encontradas |

## Validaciones posteriores a imagen de Como funciona

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |

## Validaciones posteriores a imagenes de beneficios

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |

## Validaciones posteriores a imagenes de Para quien sirve

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |
| Browser interno `http://localhost:3000/` | FAIL/BLOCKED: herramienta Browser fallo por sandbox `spawn setup refresh` |
| `Invoke-WebRequest http://localhost:3000/` | PASS, HTTP 200 |
| Verificacion SSR de rutas `/images/audience/*` | PASS, 4 rutas encontradas |

## Validaciones de cierre de fase

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 26 passed |
| `cd web && npm.cmd run lint` | PASS con warnings existentes en rutas no tocadas |
| `cd web && npm.cmd run build` | PASS con warnings existentes en rutas no tocadas |
| `git diff --check` | PASS con warnings CRLF/LF de Git, sin errores |
| `git diff --name-only` | Revisado |
| `git diff --stat` | Revisado |
| `git status --short` | Revisado |

## Riesgos

- El asset hero es una composicion comercial completa; se usa con overlay como fondo hero para evitar depender de su texto interno.
- Warnings preexistentes de lint/build pueden aparecer en rutas internas fuera de este alcance.
- Browser visual no pudo completarse por fallo de la herramienta de navegador interno; se compenso con build, lint, HTTP 200 y verificacion SSR de textos/asset.

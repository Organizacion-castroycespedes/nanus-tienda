## 1. Discovery

- [x] 1.1 Run git and OpenSpec discovery commands.
- [x] 1.2 Review public root Home and landing components.
- [x] 1.3 Review public assets and confirm hero image path.
- [x] 1.4 Review internal tenant dashboard and confirm it stays out of scope.

## 2. OpenSpec

- [x] 2.1 Create proposal.
- [x] 2.2 Create design.
- [x] 2.3 Create spec delta for `public-home-manus-pos`.
- [x] 2.4 Create implementation tasks.

## 3. Public Home Redesign

- [x] 3.1 Redesign the public hero with required headline, subheadline, CTAs, chips and hero image.
- [x] 3.2 Update public navigation anchors and CTA behavior.
- [x] 3.3 Update feature cards to the required eight real modules.
- [x] 3.4 Update benefits to the required five business benefits.
- [x] 3.5 Update feature showcase blocks for POS, Inventario, Caja, Pedidos / clientes and Reportes.
- [x] 3.6 Update how-it-works steps and final CTA copy.
- [x] 3.7 Keep responsive layout and avoid touching internal dashboard files.
- [x] 3.8 Rename feature image assets to match public routes without spaces.
- [x] 3.9 Update feature cards to use dedicated images from `/images/features/`.
- [x] 3.10 Add workflow image asset at `web/public/images/home/flows/flujo-operacion-pos.png`.
- [x] 3.11 Replace `Como funciona` step cards with the workflow image as the primary visual.
- [x] 3.12 Rename benefits image assets to kebab-case public routes.
- [x] 3.13 Update benefits cards to use dedicated images from `/images/benefits/`.
- [x] 3.14 Confirm audience image assets exist at kebab-case public routes.
- [x] 3.15 Update `Para quien sirve` cards to use dedicated images from `/images/audience/`.

## 4. Documentation

- [x] 4.1 Create `docs/evidencia-qa-home-publico-manus-pos.md`.
- [x] 4.2 Update QA evidence with manual QA PASS and final phase closure.

## 5. Validation

- [x] 5.1 Run `openspec.cmd validate redisenar-home-publico-manus-pos --type change --strict`: PASS.
- [x] 5.2 Run `openspec.cmd validate --all --strict`: PASS.
- [x] 5.3 Run `cd web && npm.cmd run lint`: PASS with existing warnings.
- [x] 5.4 Run `cd web && npm.cmd run build`: PASS with existing warnings.
- [x] 5.5 Run browser verification for `http://localhost:3000/`: attempted, blocked by Browser sandbox failure; HTTP/SSR fallback PASS.
- [x] 5.6 Run `git diff --check`: PASS with CRLF/LF warnings only.
- [x] 5.7 Run `git status --short`: PASS executed.
- [x] 5.8 Re-run OpenSpec, lint, build and diff validations after feature image update: PASS with existing warnings only.
- [x] 5.9 Re-run OpenSpec, lint, build and diff validations after workflow image update: PASS with existing warnings only.
- [x] 5.10 Re-run OpenSpec, lint, build and diff validations after benefits image update: PASS with existing warnings only.
- [x] 5.11 Re-run OpenSpec, lint, build and diff validations after audience image update: PASS with existing warnings only.
- [x] 5.12 Run final closure validations and review final diff/status: PASS with existing warnings only.

## 6. Guardrails

- [x] 6.1 Confirm backend not touched.
- [x] 6.2 Confirm SQL not touched.
- [x] 6.3 Confirm permissions and guards not touched.
- [x] 6.4 Confirm tenant dashboard not touched.
- [x] 6.5 Confirm Electron, Capacitor, peripherals, electronic invoicing and CRM not touched.

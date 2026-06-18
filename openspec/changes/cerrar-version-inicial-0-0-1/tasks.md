## 1. Discovery

- [x] 1.1 Run `git status --short`.
- [x] 1.2 Run `git rev-parse --abbrev-ref HEAD`.
- [x] 1.3 Run `git rev-parse --short HEAD`.
- [x] 1.4 Run `openspec.cmd validate --all --strict`.
- [x] 1.5 Review `docs/` tree.
- [x] 1.6 Review `openspec/` tree and active changes.
- [x] 1.7 Review `api/src/modules`.
- [x] 1.8 Review `web/modules`, `web/app` and `web/domains`.
- [x] 1.9 Review available `package.json` scripts.

## 2. Release Documentation

- [x] 2.1 Create `docs/release/estado-sistema-v0-0-1.md`.
- [x] 2.2 Create `docs/release/inventario-modulos-v0-0-1.md`.
- [x] 2.3 Create `docs/release/matriz-qa-v0-0-1.md`.
- [x] 2.4 Create `docs/release/matriz-permisos-v0-0-1.md`.
- [x] 2.5 Create `docs/release/backlog-post-v0-0-1.md`.
- [x] 2.6 Create `docs/release/riesgos-y-bloqueantes-v0-0-1.md`.
- [x] 2.7 Create `docs/release/criterios-cierre-v0-0-1.md`.

## 3. OpenSpec Artifacts

- [x] 3.1 Create `proposal.md`.
- [x] 3.2 Create `design.md`.
- [x] 3.3 Create documentary spec `release-readiness-v0-0-1`.
- [x] 3.4 Create `tasks.md`.

## 4. Final Validation

- [x] 4.1 Run `openspec.cmd validate cerrar-version-inicial-0-0-1 --type change --strict`: PASS.
- [x] 4.2 Run `openspec.cmd validate --all --strict`: PASS.
- [x] 4.3 Run API build if applicable: PASS.
- [x] 4.4 Run API tests if applicable: FAIL, 478 pass, 1 fail, 1 skipped. Failure: `InventoryService product mapping` raises `RangeError: Invalid time value` when test fixture omits `image_updated_at`.
- [x] 4.5 Run web lint if applicable: PASS with existing warnings.
- [x] 4.6 Run web build if applicable: PASS with existing warnings.
- [x] 4.7 Run `git diff --check`: PASS.
- [x] 4.8 Run `git status --short`: PASS executed; only expected new docs/OpenSpec files shown.

## 5. Guardrails

- [x] 5.1 No production touched.
- [x] 5.2 No SQL executed or created.
- [x] 5.3 No business logic changed.
- [x] 5.4 No permissions changed.
- [x] 5.5 No API contracts changed.
- [x] 5.6 No active changes mixed.
- [x] 5.7 No commit created.

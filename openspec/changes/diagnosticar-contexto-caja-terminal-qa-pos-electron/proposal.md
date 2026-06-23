# Proposal: diagnose cash-session and terminal QA blocker for packaged Electron POS

## Problem

Packaged Electron can reach login, dashboard, and the POS route. Scanner HID QA still cannot run because the POS cash-session context is blocked by inconsistent cash/register/session state.

Observed messages:

- `La caja ya tiene una sesion abierta`
- `No hay cajas abiertas para el alcance seleccionado.`
- `No tienes una sesion abierta en este momento.`
- `No hay caja abierta para el contexto operativo actual.`

## Goal

Document why the current QA user cannot complete POS runtime validation in packaged Electron, without changing backend, SQL, permissions, or business rules.

## Scope

- Review POS, finance, and reporteria endpoints involved in cash-session context.
- Document the user/tenant/branch/terminal/register/session model.
- Record the mismatch that blocks scanner QA.
- Recommend a safe unblock path for a later approved phase.

## Out of scope

- No SQL writes.
- No backend changes.
- No permission changes.
- No business rule changes.
- No scanner code changes.
- No Electron main/preload changes.
- No data cleanup.


## Context

The current validator executes the generated installer with `inspect` and `status`. `inspect` describes the embedded manifest. `status` observes service existence and state by service name, while its `serviceBinary` remains the manifest-derived expected path. The validation host may already contain another version of the service.

## Goals / Non-Goals

**Goals:**

- Make artifact validation independent of host service presence and running state.
- Preserve installer lifecycle, service registration, security, manifest, and integrity behavior.
- Make validation logic deterministic and directly testable without Windows service mutation.

**Non-Goals:**

- No installer execution beyond existing read-only `inspect` and `status` calls.
- No SCM configuration query or new observed-binary field in this change.
- No service installation, upgrade, stop, start, uninstall, registry, or deployed configuration changes.

## Decisions

- Extract pure inspect/status contract checks into a small module consumed by the validator. This enables mocked absent, stopped, running, malformed, and corrupt cases without invoking an installer.
- Remove only the assumptions that `servicePresent` and `serviceRunning` must be false. A running service is informational host state, not an artifact failure.
- Retain `serviceBinary` unchanged. Adding `observedServiceBinary` would require reading `Service.Config()` and defining ownership/version semantics; that is a separate follow-up.
- Enforce only the safe invariant that a running service must also be present. Do not infer installation version from service presence.
- Update README examples to use the approved QA internal version while explicitly documenting that `MANUS_INSTALLER_OUTPUT_NAME` may be a custom filename only.

## Risks / Trade-offs

- A stale or different service can exist during artifact validation → report presence/running state as informational and keep separate installation validation responsible for SCM ownership checks.
- Pure checks could drift from the executable output contract → keep checks in the existing validator path and add focused tests for every accepted/rejected state.

## Migration Plan

No runtime migration. Ship the validator and tests; existing installers and service registrations remain unchanged.

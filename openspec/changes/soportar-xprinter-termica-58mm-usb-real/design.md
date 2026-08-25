## Context

The repo already has a thermal printing stack for Peripheral Agent. USB discovery exists, real USB print transports exist for Windows, and the codebase already defines `THERMAL_58MM`. The problem is that the current operational path still treats USB printers as effectively 80 mm in discovery and defaults, and the 58 mm path has not been certified with physical hardware.

This change is phase 1 only. It must certify a real Xprinter 58 mm USB printer on Windows x64 through Peripheral Agent, without touching scanner, balanza, database, or cash drawer behavior.

## Goals / Non-Goals

**Goals:**
- Certify a real 58 mm USB printer path end to end.
- Keep the 80 mm path stable and regression-free.
- Make USB discovery and printer selection stable enough for real workstation use.
- Return real print results only when bytes are actually sent to transport.
- Surface the new printer in admin peripherals with minimal UI change.

**Non-Goals:**
- No cash drawer transport changes in this phase.
- No scanner, balanza, DB, migration, push, or deploy work.
- No new device class for the drawer.
- No redesign of the admin peripherals screen.

## Decisions

### 1. Keep a dedicated `THERMAL_58MM` profile
Use a separate profile instead of aliasing 58 mm to `THERMAL_80MM`.

Why:
- The repo already has a 58 mm profile entry, but the current flow still behaves like 80 mm in several places.
- A dedicated profile lets discovery, renderer width, and response capabilities stay explicit.

Alternatives considered:
- Reuse `THERMAL_80MM` and override width in the renderer. Rejected because it would hide the real capability contract.
- Infer width dynamically from queue metadata. Rejected because the current discovery sources do not reliably provide a printer width signal.

### 2. Treat width as a profile property, not a hardcoded renderer constant
The renderer and formatter must use the profile width that comes with the selected printer.

Why:
- The current code has a fixed 48 char thermal reference for 80 mm and a separate 32 char 58 mm profile.
- Width must not be recalculated independently by each adapter or UI path, or the layout will drift.

Alternatives considered:
- Add a global 58 mm constant in the renderer. Rejected because it would spread a new fixed width without tying it to the certified profile.
- Reuse 80 mm wrapping logic with smaller font. Rejected because it risks silent overflow on 58 mm paper.

### 3. Use stable USB descriptor identity for discovery and dedupe
Discovery should keep the agent installation id, native identifier, fingerprint, platform, and architecture as the stable public descriptor. Configured USB printers must not be replaced by a fresh discovery result just because the USB order changed.

Why:
- USB ordering is not stable.
- The current device registry already distinguishes configured devices from discovered USB devices.

Alternatives considered:
- Use array position or transient queue order as id. Rejected because it is fragile.
- Replace configured USB devices on every discovery. Rejected because it would break persistence and cause churn.

### 4. Real success means transport confirmation
`test-print` and `print-ticket` must only report success when the adapter confirms bytes were sent.

Why:
- A rendered preview alone is not a hardware certification.
- The user asked for `mode = REAL`, adapter metadata, and `bytesSent` on the response.

Alternatives considered:
- Keep simulation success semantics. Rejected because it would hide transport failures.

### 5. Keep cut handling capability-driven
The 58 mm profile must expose cutter capability only if the physical device is certified for it. Printing must still work when cutter capability is false.

Why:
- The user explicitly said not to assume a cutter.
- CUT must never be used as proof of physical cut unless QA certifies it.

Alternatives considered:
- Force CUT on for every thermal printer. Rejected because it would overclaim hardware support.

### 6. Scope admin UI to selection and test print
Only surface the new 58 mm USB printer in the admin peripherals screen. Keep the current layout and general workflow.

Why:
- This is a focused hardware enablement, not a screen redesign.
- The UI already has printer selection and test actions, so the change should stay narrow.

## Risks / Trade-offs

- [Risk] The real Xprinter 58 mm may not match the current 32 char width. → Mitigation: validate with physical QA and adjust only the 58 mm profile if the certified output disagrees.
- [Risk] USB queue identity can change across reboots or driver changes. → Mitigation: rely on stable descriptor fields and existing configured-device preservation.
- [Risk] The hardware may not have a cutter. → Mitigation: keep CUT optional and allow successful printing when unsupported.
- [Risk] Windows RAW and GDI transports may behave differently on the target workstation. → Mitigation: certify the exact transport path during QA and keep the fallback explicit.
- [Risk] Discovery could produce duplicate USB entries if fingerprinting is too weak. → Mitigation: dedupe on stable identity, not queue order.
- [Risk] UI might expose a printer that is discovered but not yet physically certified. → Mitigation: label the device by profile and status, and only mark hardware PASS after QA.

## Migration Plan

1. Land the 58 mm capability behind the existing Peripheral Agent flow.
2. Validate discovery, rendering, and real print responses on the target Windows x64 workstation.
3. Keep the 80 mm path untouched and verify regression tests.
4. Roll back by disabling selection of the new 58 mm printer or reverting the 58 mm-specific code paths if physical QA fails.

## Open Questions

- Is the certified 58 mm Xprinter expected to support a physical cutter?
- Does the workstation need RAW or GDI transport for the certified USB queue?
- Is the current 32 char 58 mm profile width the final certified width, or does physical output require a different value?
- Does the discovery fingerprint need any extra hardware fields beyond the current stable descriptor?

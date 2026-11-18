# Design

## Context

The Agent currently has one setting with two effects: the adapter resolver reads `enableRealAdapters`, while `main.ts` and the packaged installer WebView also use it to start broad discovery. The QA installer package and the Agent share an embedded local JSON config. Configuration loads once before runtime startup; changing it does not hot-reload the running service.

The existing discovery operation inventories USB printer queues/PnP and serial candidates together. Its providers do not offer a stable per-device scan primitive. Discovery returns candidates; choosing, configuring, pairing, and operating a device are separate actions. This change will keep that manual operation explicit and will not invent a narrower protocol or add new adapters.

## Goals / Non-Goals

**Goals:**

- Separate real adapter availability from automatic startup discovery.
- Make startup discovery opt-in with a strict boolean and fail-closed behavior in the Agent and installer UI.
- Package QA as `enableRealAdapters=true`, `discoverOnStartup=false`, so a future authorized QA run can request a manual scan while startup stays quiet.
- Preserve dev/production behavior by packaging both settings explicitly as true.
- Keep local health independent of hardware and preserve all current enrollment, scale, printer, drawer, and scanner guards.

**Non-Goals:**

- Do not change Build 04 or any installed host state.
- Do not run a build that writes an installer into the prior candidate directory; do not install or operate hardware.
- Do not add protocol discovery, new scanner/serial/Bluetooth adapters, persistence, enrollment material, or device-specific pairing behavior.
- Do not change existing device-specific capability contracts.

## Decisions

1. **Use `discoverOnStartup` as an independent boolean.** The Agent will start discovery only when `enableRealAdapters === true && discoverOnStartup === true`. Missing, malformed, or unreadable packaged config will not enable it. This keeps health and real adapter capability separate from background inventory.

2. **Load the setting through the existing local config path.** Package JSON records a validated `packageProfile`. The Agent derives its effective profile from that file, ignoring a conflicting inherited profile variable. QA locks `PERIPHERALS_DISCOVER_ON_STARTUP=false` even when an inherited environment variable or stale JSON value says `true`; dev/production keep environment-over-JSON precedence. Missing, unreadable, or unverified profiles fail closed. Configuration is read at process startup, so a future setting change requires a service restart.

3. **Package profiles declare both policies.** QA will package `enableRealAdapters=true` and `discoverOnStartup=false`; dev and production will set both to true to preserve current behavior. This only affects future artifacts. The installed Build 04 config remains unchanged.

4. **Gate installer startup from the same embedded config.** The productive installer WebView will read `discoverOnStartup` and require `enableRealAdapters` too. Missing fields, parse failures, or a false adapter flag suppress automatic discovery. The existing manual retry remains an explicit operator action.

5. **Keep candidate selection and device certification separate.** The current explicit discovery operation inventories the existing supported providers. Its results do not automatically assign, pair, authorize, or operate hardware. Narrow scans by device/transport are deferred because today's combined provider and reconciliation state does not expose a safe per-device scan contract; a later change must add that with its own tests and ownership.

6. **Use single-match ownership for the changed code.** The new scope entry owns only the Agent config/startup/package files, the Windows discovery runner and its boundary test, the installer WebView files, and focused tests. Existing ROCHI, printer, drawer, scanner, enrollment, and database implementation ownership stays with its current changes. No broad directory owner or exemption is added.

7. **Keep automated Windows discovery inert.** The default Windows command runner rejects when running under `node:test`; discovery tests must inject fake command runners or providers. A focused negative test and a native-process/socket guard prove the default provider cannot reach PowerShell, PnP, spooler, or serial enumeration in that test file.

8. **Merge Windows serial inventories independently.** `Win32_SerialPort` and `Get-PnpDevice -PresentOnly` are queried separately so a CIM record for another COM port cannot suppress a PnP-only CH340. Only records with a COM port, PnP identity, `Present=true`, and `Status=OK` are candidates. Exact normalized identity/port duplicates collapse to one; conflicting mappings are excluded. One source failure is logged while valid results from the other remain usable; two source failures return a controlled discovery error. Exact CH340 VID/PID matching remains the existing ROCHI candidate rule and proves neither communication nor weight.

## Risks / Trade-offs

- [Legacy config lacks the new field] → Automatic startup discovery becomes disabled. Explicit manual discovery remains available when real adapters are enabled.
- [QA package now allows real adapter operations] → It still has no trust key or Key ID, so pairing and commercial scale authorization remain fail-closed; physical use also requires a separate operator QA action.
- [Future production config omits the field] → Discovery is suppressed until packaging supplies the explicit production value; no implicit fallback to `enableRealAdapters` is used.
- [Current discovery inventories more than one protocol] → It remains a manual broad candidate scan. Per-device/transport scoping is not claimed by this change.
- [New installer bytes differ from installed Build 04] → P0-B admission remains authoritative. This change does not authorize repair, update, reinstall, or host mutation.

## Physical QA Preparation

All rows below are plans only. No inventory, port, printer, or scanner operation is run by this change.

| Device | Safe preparation and future physical check | Gates and authorization |
| --- | --- | --- |
| ROCHI A01E | Record operator-confirmed COM path and serial settings; only after approval, capture a bounded read, check freshness and parser errors, then verify the POS weight flow with QA data. | Enrollment trust, pairing, binding, explicit KG confirmation, and a separate physical-read authorization. Stable weight is not inferred by the adapter. |
| XP-80/XP-80T USB | Confirm the operator-selected Windows print queue and 80 mm profile; later send one approved test page/receipt. | Explicit print authorization; do not use a sales ticket. |
| XP-80/XP-80T NETWORK | Operator supplies the exact QA host and port; later send one approved test page. The repository supports a network path but this change does not scan IP ranges. | Explicit network-printer and print authorization; no guessed address. |
| XP-58 USB | Confirm the operator-selected queue and 58 mm profile; later print one approved format sample. | Explicit print authorization; drawer pulse remains a separate operation. |
| Cash drawer | Select its already-certified parent printer; only later send one pulse if approved. | Separate explicit drawer-opening approval; no automatic opening on sale. |
| USB HID barcode reader | Check keyboard-wedge input with the POS search field focused, repeated scans, and focus retention. | A user-supplied QA barcode and explicit scanner-test approval; no Agent USB discovery is needed. |

Manual discovery is currently broad because its provider enumerates USB printer queues/PnP and serial candidates together. A future device-scoped discovery change must pass the selected protocol scope to the provider, keep serial discovery inventory-only until the operator chooses a candidate, and avoid discovery for network printers and keyboard-wedge scanners.

## Migration Plan

1. Add the new field to package-generated config and the local config parser.
2. Roll out the Agent and installer behavior only through a separately approved, versioned QA artifact.
3. Before any host transition, evaluate P0-B against the installed Build 04 identity. Current admission allows same-candidate repair only when bytes match; a different target version returns `transition_unproven`, and a same-version/different-byte payload returns `candidate_bytes_differ`. No supported update path is demonstrated. A future candidate needs a new version/identity and either an explicitly implemented P0-B update contract or a separately authorized conservative removal followed by proven FRESH. Do not install a different-byte artifact as repair.
4. Keep QA pairing blocked until the QA API owner supplies accredited matching trust material through the approved secret/provisioning path.

Rollback is a separately admitted package transition. Do not edit installed files or bypass the Windows installer admission gate.

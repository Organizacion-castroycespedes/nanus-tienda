## Context

XP-58 USB printing is already certified. The remaining work is the logical cash drawer flow that hangs off the same physical printer transport. The current backend already has `POST /cash-drawer/open`, but USB printers still report `supportsCashDrawerPulse = false` and `UsbSystemPrinterAdapter.openCashDrawer()` rejects the request.

Discovery on the current code shows:

- `WindowsRawSpoolerTransport.send()` can write an arbitrary Buffer to the Windows queue.
- `UsbSystemPrinterAdapter` already uses that RAW transport for print jobs.
- The drawer path is blocked in the adapter capability gate, not in the low-level byte transport.
- `supportsCut` is unrelated and must stay separate from drawer support.
- The device registry can persist device metadata, so a device-scoped drawer certification flag can be stored without adding a DB or a new device type.

## Goals / Non-Goals

**Goals:**
- Certify a real drawer pulse through the XP-58 USB printer transport.
- Keep the drawer logical and tied to `printerDeviceId`.
- Send exactly one pulse per request.
- Return QA-friendly real responses with transport metadata.
- Keep XP-80 LAN drawer behavior unchanged.

**Non-Goals:**
- No new USB device for the drawer.
- No DB or migration work.
- No scanner, balanza, or other printer models.
- No automatic open on sale unless an already-approved rule exists.
- No dependence on cutter support.

## Decisions

### 1. Reuse the canonical printer as the drawer transport
The drawer should resolve through the printer assigned to the terminal, not through a separate host/port drawer device.

Why:
- The printer already owns the USB transport.
- It avoids duplicate config and keeps the terminal model simple.

Alternatives considered:
- Add a separate USB drawer device. Rejected because it duplicates hardware and config.
- Store host/port on the drawer. Rejected because it creates a second transport owner.

### 2. Keep drawer support device-scoped, not brand-scoped
Drawer support must be certified for the specific XP-58 device, not inferred from brand or paper width alone.

Why:
- The current `THERMAL_58MM` profile is about print layout, not drawer certification.
- A device-scoped gate avoids turning on drawer support for every USB printer that happens to share a profile.

Alternatives considered:
- Enable drawer support from `supportsCut`. Rejected because cut and drawer are separate capabilities.
- Enable drawer support for every USB printer. Rejected because it would overclaim capability.

### 3. Use the existing RAW spooler path for the pulse
The drawer pulse should travel through the same Windows RAW transport that already writes printer bytes.

Why:
- `WindowsRawSpoolerTransport.send()` already accepts arbitrary payload bytes.
- The ESC/POS drawer pulse is only five bytes.

Alternatives considered:
- Add a new transport just for drawer pulses. Rejected because it duplicates the spooler path.
- Send the pulse through print-ticket rendering. Rejected because drawer pulse is not a receipt layout concern.

### 4. One request equals one pulse
The open endpoint should write one pulse once and not retry automatically inside the same request.

Why:
- Repeating the pulse can double-open the drawer.
- Hardware QA needs a clear one-request-one-action contract.

Alternatives considered:
- Retry on ambiguous failure. Rejected because the drawer may already have moved.

### 5. Keep cut and drawer separate
The drawer must not depend on cutter support or physical cut certification.

Why:
- The XP-58 has no automatic cutter certified in this phase.
- Manual cut and drawer open are different hardware capabilities.

Alternatives considered:
- Gate drawer support on `supportsCut`. Rejected because that would block valid drawer hardware.

## Risks / Trade-offs

- [Risk] The RAW transport may succeed while the drawer wiring is wrong. -> Mitigation: require physical QA with the real XP-58 and the attached drawer.
- [Risk] Enabling drawer support at the profile level could overclaim capability for other 58 mm printers. -> Mitigation: keep certification device-scoped.
- [Risk] Ambiguous failures could lead to double-open behavior if retried. -> Mitigation: do not retry automatically inside one request.
- [Risk] The admin UI could expose drawer actions before the hardware is certified. -> Mitigation: show certification status and keep human QA as the gate.
- [Risk] XP-80 LAN regression. -> Mitigation: add drawer and print regressions around the existing network path.

## Migration Plan

1. Keep the existing XP-80 LAN drawer change untouched.
2. Add the XP-58 USB drawer path behind the same logical endpoint.
3. Certify on local hardware first.
4. Validate on the target workstation with physical QA.
5. Roll back by removing the XP-58 drawer certification path if hardware QA fails.

## Open Questions

- The device-scoped drawer certification lives in persisted device metadata as `usbRawCashDrawerPulseCertified`.
- Does the XP-58 drawer require connector 0/pin 2 or a different ESC/POS pulse profile?
- Should the admin UI show drawer certification state explicitly?

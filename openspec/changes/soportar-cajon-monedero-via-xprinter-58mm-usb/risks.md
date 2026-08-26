## Risks

- The RAW USB path may send bytes but the XP-58 drawer wiring may not be correct. Mitigation: require physical QA with the real drawer.
- A profile-level capability could overclaim support for other 58 mm printers. Mitigation: keep drawer certification device-scoped.
- Automatic retries could double-open the drawer. Mitigation: one request = one pulse, no retry.
- Drawer capability could be confused with cut capability. Mitigation: keep them separate in spec and UI.
- XP-80 LAN regression is possible if shared cash drawer code is changed too broadly. Mitigation: keep tests for the existing LAN path green.

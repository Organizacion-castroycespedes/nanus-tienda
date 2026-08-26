## Risks

- The certified 58 mm printer may not match the current 32 char layout. Mitigation: keep the profile explicit and adjust only after physical output proves a different width.
- The device may not support a cutter. Mitigation: keep CUT capability explicit and non-blocking.
- USB queue naming can change across restarts. Mitigation: preserve stable descriptor identity and dedupe by stable fields.
- Windows RAW and GDI transports may differ on the target workstation. Mitigation: certify the actual transport path during QA before declaring the printer ready.
- A discovered USB printer may not be the physical target printer. Mitigation: require physical QA and keep admin selection explicit by profile and USB metadata.
- Existing 80 mm and XP-80 LAN flows could regress if the 58 mm logic is made global. Mitigation: keep the 58 mm work profile-scoped and add regression tests.

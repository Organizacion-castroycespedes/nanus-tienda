## Risks

- Hardcoding port 9100 would hide real device differences.
- Replacing the USB config could break TERM-001.
- A generic network failure message can hide the real root cause.
- The same bytes can still fail if the printer firmware or network path is bad.

## Context

Scanner HID devices normally behave like a keyboard. The browser receives
keypresses, not USB packets. The robust path is a frontend keyboard wedge with
timing rules and a terminator, not a native HID API.

## Decision

Preferred architecture:

```text
Scanner physical
  -> USB HID
  -> Windows keyboard input
  -> Manus client
```

The POS search field becomes the global scanner capture surface. A scan is only
committed when the input stream is fast enough and ends with `Enter`.

## Terminal Representation

The scanner capability is represented in TERM-001 configuration as a POS
scanner feature bound to the terminal, not as a hard-coded scanner model.
If the keyboard-wedge flow does not need a physical `deviceId`, the config
must keep that explicit in docs and QA evidence.

## Constraints

- No native HID APIs.
- No USB RAW for scanner.
- No scanner model hardcoding.
- No interference with normal typing in inputs.
- No regression for the existing mock scanner event flow.

## 1. Discovery and behavior

- [x] 1.1 Review the current scanner mock flow, POS search path and websocket
  event handling.
- [x] 1.2 Confirm the POS catalog matcher for barcode, SKU and aliases.
- [x] 1.3 Define the timing rules that separate scanner wedge input from slow
  human typing.

## 2. Implementation

- [x] 2.1 Add a reusable keyboard-wedge scanner helper with timing state.
- [x] 2.2 Wire the helper into the POS search input without breaking manual
  search.
- [x] 2.3 Reset scanner state after a scan, error or terminator.
- [x] 2.4 Keep the existing mock scanner websocket flow intact.

## 3. Tests and docs

- [x] 3.1 Add tests for fast scan + Enter, slow typing rejection and repeated
  scans.
- [x] 3.2 Add a test for scanner disabled behavior and no regression in manual
  search.
- [x] 3.3 Document how TERM-001 represents the scanner capability when no
  physical `deviceId` is needed.
- [x] 3.4 Prepare manual QA steps for physical scanner validation.

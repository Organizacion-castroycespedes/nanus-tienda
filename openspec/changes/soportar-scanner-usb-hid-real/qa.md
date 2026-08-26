## QA

### Manual physical QA

1. Connect a USB HID barcode scanner.
2. Open the POS.
3. Scan an existing product.
4. Confirm the product is added once.
5. Scan a nonexistent barcode.
6. Confirm the warning is controlled.
7. Type slowly by hand and confirm it does not auto-add.
8. Scan several times in a row.
9. Confirm focus keeps returning to the POS search field.
10. Reload the POS and repeat.

### Final physical evidence

- Windows USB HID detection: PASS
- Device observed: `HID\VID_0C2E&PID_0901`
- HID keyboard / keyboard wedge: PASS
- Physical barcode scan: PASS
- Repeated physical scan: PASS
- Manus POS scanner integration: PASS
- Regression QA: PASS
- Final manual QA: PASS

Observed barcode:

- `353962561087655`

Notes:

- The scanner behaves as HID keyboard input.
- The same barcode could be scanned repeatedly.
- Validation outside Manus in a text editor also passed.

### Evidence rule

Do not mark hardware PASS without a physical test.

### Out of scope

The issue seen later on `/inventory/products` with product images belongs to a
different environment/server. It is not a scanner defect and is out of scope
for this change.

### Technical implementation note

- Scanner capture uses keyboard wedge in the POS search field.
- `USB_HID` appears in `/[tenant]/admin/peripherals` as capability state.
- `mock-scanner-001` stays in technical/QA flows only.

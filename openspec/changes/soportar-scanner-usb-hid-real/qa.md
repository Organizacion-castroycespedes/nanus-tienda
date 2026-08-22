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

### Evidence rule

Do not mark hardware PASS without a physical test.

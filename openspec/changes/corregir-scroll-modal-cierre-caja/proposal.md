# Change: corregir-scroll-modal-cierre-caja

## Summary

Adjust the cash close modal in `/{tenant}/finance/cash-sessions` so reduced-height and mobile viewports keep close content and final actions accessible.

## Problem

The cash close modal can exceed the viewport height. Its form content has no internal scroll boundary and the final actions live at the bottom of a tall content block, so users can lose access to `Cancelar` and `Cerrar caja`.

## Scope

- Add viewport-based height limits to the close modal.
- Add an internal scroll area for the close form content.
- Keep final close actions outside the scroll area and accessible.
- Avoid horizontal overflow in the close modal content.

## Out of Scope

- Backend changes.
- SQL or migrations.
- Cash close calculations or payload changes.
- Cash audit logic changes.
- Cash close ticket changes.
- Payment, delivery, POS, or permission behavior changes.

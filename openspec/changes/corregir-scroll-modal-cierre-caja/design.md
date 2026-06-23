# Design

## Current Behavior

The cash sessions page opens `CloseCashSessionForm` inside the shared `Modal` component. The close modal only sets width via `size="xl"` and `className="max-w-5xl"`. The form renders all sections and final actions in a single normal document flow.

When the viewport is short, the modal grows taller than the available screen and the final action buttons can move outside the visible area.

## Approach

Keep this change local to the close cash UI:

- Apply `max-h` and `overflow-hidden` to the close modal instance.
- Make `CloseCashSessionForm` a vertical flex container with a bounded height.
- Put summary, breakdown, counted cash, and observations inside a `flex-1` scroll area.
- Put `Cancelar` and `Cerrar caja` in a footer outside the scroll area.
- Use `min-h-0`, `min-w-0`, `overflow-x-hidden`, `break-words`, and `tabular-nums` where needed so content wraps cleanly.

## Non-Functional Constraints

The form state, callbacks, calculations, submitted payload, and service calls remain unchanged. The change is visual only.

## QA Notes

Visual QA should check desktop, reduced-height desktop, and mobile widths. The breakdown table can keep its own horizontal scroll inside the panel, but the page should not gain global horizontal overflow from the close modal.

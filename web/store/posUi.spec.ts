import assert from "node:assert/strict";
import { describe, it } from "node:test";

import posUiReducer, {
  initialPosUiState,
  closeCartSheet,
  openCartSheet,
  setCartSheetOpen,
  toggleCartSheet,
} from "./posUi";

describe("POS UI state", () => {
  it("opens and closes the shared cart sheet", () => {
    const opened = posUiReducer(initialPosUiState, openCartSheet());
    assert.equal(opened.cartSheetOpen, true);

    const closed = posUiReducer(opened, closeCartSheet());
    assert.equal(closed.cartSheetOpen, false);
  });

  it("toggles the shared cart sheet", () => {
    const opened = posUiReducer(initialPosUiState, toggleCartSheet());
    assert.equal(opened.cartSheetOpen, true);

    const closed = posUiReducer(opened, setCartSheetOpen(false));
    assert.equal(closed.cartSheetOpen, false);
  });
});

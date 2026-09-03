import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PosUiState = {
  cartSheetOpen: boolean;
};

export const initialPosUiState: PosUiState = {
  cartSheetOpen: false,
};

const posUiSlice = createSlice({
  name: "posUi",
  initialState: initialPosUiState,
  reducers: {
    setCartSheetOpen(state, action: PayloadAction<boolean>) {
      state.cartSheetOpen = action.payload;
    },
    openCartSheet(state) {
      state.cartSheetOpen = true;
    },
    closeCartSheet(state) {
      state.cartSheetOpen = false;
    },
    toggleCartSheet(state) {
      state.cartSheetOpen = !state.cartSheetOpen;
    },
  },
});

export const {
  setCartSheetOpen,
  openCartSheet,
  closeCartSheet,
  toggleCartSheet,
} = posUiSlice.actions;

export default posUiSlice.reducer;

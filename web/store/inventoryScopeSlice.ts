import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type InventoryScopeState = {
  currentTenant: string | null;
  currentBranch: string | null;
};

const initialState: InventoryScopeState = {
  currentTenant: null,
  currentBranch: null,
};

const inventoryScopeSlice = createSlice({
  name: "inventoryScope",
  initialState,
  reducers: {
    setInventoryScope(
      state,
      action: PayloadAction<{
        currentTenant?: string | null;
        currentBranch?: string | null;
      }>
    ) {
      if (action.payload.currentTenant !== undefined) {
        state.currentTenant = action.payload.currentTenant;
      }
      if (action.payload.currentBranch !== undefined) {
        state.currentBranch = action.payload.currentBranch;
      }
    },
    clearInventoryScope() {
      return { ...initialState };
    },
  },
});

export const { setInventoryScope, clearInventoryScope } = inventoryScopeSlice.actions;

export default inventoryScopeSlice.reducer;

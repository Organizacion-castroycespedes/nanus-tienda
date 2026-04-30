import { configureStore } from "@reduxjs/toolkit";
import brandingReducer from "./brandingSlice";
import companyReducer from "./companySlice";
import authReducer from "./authSlice";
import menuReducer from "./menuSlice";
import inventoryScopeReducer from "./inventoryScopeSlice";
import posReducer from "./pos";
import posCartReducer from "./posCart";

export const store = configureStore({
  reducer: {
    branding: brandingReducer,
    company: companyReducer,
    auth: authReducer,
    menu: menuReducer,
    inventoryScope: inventoryScopeReducer,
    pos: posReducer,
    posCart: posCartReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

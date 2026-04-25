import { useState } from "react";
import type { AuthState } from "./store";
import { initialAuthState } from "./store";

export const useAuthState = () => {
  const [state, setState] = useState<AuthState>(initialAuthState);
  return { state, setState };
};

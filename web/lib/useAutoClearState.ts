import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

export const useAutoClearState = <T>(
  value: T | null,
  setValue: Dispatch<SetStateAction<T | null>>,
  delayMs = 30000
) => {
  useEffect(() => {
    if (value === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setValue(null);
    }, delayMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, setValue, delayMs]);
};

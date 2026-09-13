"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createTerminalReadinessOrchestrator } from "./orchestrator";
import type { EvaluationInput } from "./orchestrator";
import type { TerminalReadinessResult } from "./contracts";

export const useTerminalReadiness = (input: EvaluationInput | null) => {
  const orchestrator = useMemo(() => createTerminalReadinessOrchestrator(), []);
  const [value, setValue] = useState<TerminalReadinessResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const evaluate = useCallback(async () => {
    if (!input) { setValue(null); return; }
    setError(null);
    try { setValue(await orchestrator.evaluate(input)); } catch (cause) { setError(cause instanceof Error ? cause : new Error("Readiness failed")); }
  }, [input, orchestrator]);
  useEffect(() => { void evaluate(); }, [evaluate]);
  return { value, error, retry: evaluate };
};

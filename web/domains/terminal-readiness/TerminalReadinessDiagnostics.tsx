"use client";

import type { TerminalReadinessResult } from "./contracts";
import { isLocalQaLocation } from "./diagnostics-access";

const mask = (value: string | null) =>
  value && value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value ?? "-";

export const TerminalReadinessDiagnostics = ({
  value,
  enabled,
}: {
  value: TerminalReadinessResult;
  enabled?: boolean;
}) => {
  const localQaOrigin =
    typeof window !== "undefined" && isLocalQaLocation(window.location);
  const queryEnabled =
    localQaOrigin &&
    new URLSearchParams(window.location.search).get("terminalReadinessDiagnostics") === "1";

  if (!localQaOrigin || !(enabled ?? queryEnabled)) {
    return null;
  }

  return (
    <aside id="terminal-readiness-diagnostics" className="mx-auto mb-4 max-w-7xl rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm" data-testid="terminal-readiness-diagnostics">
      <p className="font-semibold">Diagnóstico QA local · solo lectura</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="font-medium">resolution</dt><dd>{value.resolution}</dd></div>
        <div><dt className="font-medium">deviceStatus</dt><dd>{value.device.status ?? "-"}</dd></div>
        <div><dt className="font-medium">terminalId</dt><dd>{mask(value.terminal.terminalId)}</dd></div>
        <div><dt className="font-medium">branchId</dt><dd>{mask(value.terminal.branchId)}</dd></div>
        <div><dt className="font-medium">agent.reachable</dt><dd>{String(value.agent.reachable)}</dd></div>
        <div><dt className="font-medium">cloud.reachable</dt><dd>{String(value.cloud.reachable)}</dd></div>
        <div><dt className="font-medium">readiness</dt><dd>{value.state}</dd></div>
        <div><dt className="font-medium">canEnterPos</dt><dd>{String(value.canEnterPos)}</dd></div>
        <div><dt className="font-medium">reason</dt><dd>{value.reason}</dd></div>
      </dl>
    </aside>
  );
};

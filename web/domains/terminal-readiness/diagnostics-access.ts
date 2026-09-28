type LocalQaLocation = Pick<Location, "hostname" | "port">;

type DiagnosticsShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "target">;

export const isLocalQaLocation = ({ hostname, port }: LocalQaLocation) =>
  (hostname === "localhost" || hostname === "127.0.0.1") &&
  (port === "3000" || port === "");

export const hasElectronTerminalBridge = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { getRuntimeInfo?: unknown }).getRuntimeInfo === "function"
  );

export const isTerminalDiagnosticsShortcut = (event: DiagnosticsShortcutEvent) => {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();

  return (
    event.key.toLowerCase() === "d" &&
    event.ctrlKey &&
    event.altKey &&
    event.shiftKey &&
    !event.repeat &&
    tagName !== "input" &&
    tagName !== "textarea" &&
    tagName !== "select" &&
    !target?.isContentEditable
  );
};

export type DisplayWorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const calculateTerminalBounds = (workArea: DisplayWorkArea) => ({
  x: workArea.x,
  y: workArea.y,
  width: Math.max(1, workArea.width),
  height: Math.max(1, workArea.height),
});

export const shouldRecoverRenderer = (
  recoveryTimes: number[],
  now: number,
  maxRecoveries = 3,
  windowMs = 60_000,
) => recoveryTimes.filter((time) => now - time < windowMs).length < maxRecoveries;

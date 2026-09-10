export type DisplayWorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerminalWindowStateTarget = {
  isDestroyed(): boolean;
  setMenuBarVisibility(visible: boolean): void;
  isFullScreen(): boolean;
  setFullScreen(fullscreen: boolean): void;
  getBounds(): DisplayWorkArea;
  setBounds(bounds: DisplayWorkArea): void;
  show(): void;
};

export const boundsCoverDisplay = (windowBounds: DisplayWorkArea, displayBounds: DisplayWorkArea) => (
  windowBounds.x <= displayBounds.x
  && windowBounds.y <= displayBounds.y
  && windowBounds.x + windowBounds.width >= displayBounds.x + displayBounds.width
  && windowBounds.y + windowBounds.height >= displayBounds.y + displayBounds.height
);

export const enforceTerminalWindowState = (
  window: TerminalWindowStateTarget,
  displayBounds: DisplayWorkArea,
) => {
  if (window.isDestroyed()) {
    return;
  }

  window.setMenuBarVisibility(false);
  if (!window.isFullScreen()) {
    window.setFullScreen(true);
  }
  if (!boundsCoverDisplay(window.getBounds(), displayBounds)) {
    window.setBounds(displayBounds);
  }
};

export const showAndEnforceTerminalWindow = (
  window: TerminalWindowStateTarget,
  displayBounds: DisplayWorkArea,
) => {
  enforceTerminalWindowState(window, displayBounds);
  if (window.isDestroyed()) {
    return;
  }
  window.show();
  enforceTerminalWindowState(window, displayBounds);
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

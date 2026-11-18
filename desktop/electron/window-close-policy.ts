export type CloseBehavior = "quit" | "hide";
export type WindowCloseAction = "allow" | "hide" | "quit";

export interface WindowCloseEventLike {
  preventDefault(): void;
}

export interface WindowCloseTargetLike {
  hide(): void;
}

export const parseCloseBehavior = (value: string | undefined): CloseBehavior => {
  return value === "hide" ? "hide" : "quit";
};

export const handleWindowClose = (
  behavior: CloseBehavior,
  isQuitting: boolean,
  maintenanceExitAllowed: boolean,
  event: WindowCloseEventLike,
  window: WindowCloseTargetLike,
  quit: () => void,
): WindowCloseAction => {
  if (isQuitting || maintenanceExitAllowed) {
    return "allow";
  }

  event.preventDefault();
  if (behavior === "hide") {
    window.hide();
    return "hide";
  }

  quit();
  return "quit";
};

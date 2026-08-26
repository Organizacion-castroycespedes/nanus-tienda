export type FloatingControlPosition = {
  x: number;
  y: number;
};

export type FloatingControlViewport = {
  width: number;
  height: number;
};

export type FloatingControlSize = {
  width: number;
  height: number;
};

export type FloatingControlAnchor = "top-right" | "bottom-right";

export const FLOATING_CONTROL_MARGIN = 16;
export const FLOATING_CONTROL_TOP_BOUNDARY = 96;
export const FLOATING_CONTROL_DRAG_THRESHOLD = 6;

export const FLOATING_POS_STORAGE_KEY = "manus.pos.floating-pos-position";
export const FLOATING_CART_STORAGE_KEY = "manus.pos.floating-cart-position";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const shouldTreatFloatingControlMovementAsDrag = (
  deltaX: number,
  deltaY: number
) => Math.hypot(deltaX, deltaY) >= FLOATING_CONTROL_DRAG_THRESHOLD;

export const clampFloatingControlPosition = (
  position: FloatingControlPosition,
  viewport: FloatingControlViewport,
  size: FloatingControlSize,
  minTop = FLOATING_CONTROL_TOP_BOUNDARY
): FloatingControlPosition => {
  const maxX = Math.max(
    FLOATING_CONTROL_MARGIN,
    viewport.width - size.width - FLOATING_CONTROL_MARGIN
  );
  const maxY = Math.max(
    minTop,
    viewport.height - size.height - FLOATING_CONTROL_MARGIN
  );

  return {
    x: clamp(position.x, FLOATING_CONTROL_MARGIN, maxX),
    y: clamp(position.y, minTop, maxY),
  };
};

export const resolveFloatingControlDefaultPosition = (
  anchor: FloatingControlAnchor,
  viewport: FloatingControlViewport,
  size: FloatingControlSize,
  minTop = FLOATING_CONTROL_TOP_BOUNDARY
): FloatingControlPosition => {
  const rightX = Math.max(
    FLOATING_CONTROL_MARGIN,
    viewport.width - size.width - FLOATING_CONTROL_MARGIN
  );
  const y =
    anchor === "top-right"
      ? minTop
      : Math.max(minTop, viewport.height - size.height - FLOATING_CONTROL_MARGIN);

  return clampFloatingControlPosition({ x: rightX, y }, viewport, size, minTop);
};

export const snapFloatingControlPosition = (
  position: FloatingControlPosition,
  viewport: FloatingControlViewport,
  size: FloatingControlSize,
  minTop = FLOATING_CONTROL_TOP_BOUNDARY
): FloatingControlPosition => {
  const snappedX =
    position.x + size.width / 2 < viewport.width / 2
      ? FLOATING_CONTROL_MARGIN
      : Math.max(
          FLOATING_CONTROL_MARGIN,
          viewport.width - size.width - FLOATING_CONTROL_MARGIN
        );

  return clampFloatingControlPosition(
    { x: snappedX, y: position.y },
    viewport,
    size,
    minTop
  );
};

export const readFloatingControlPosition = (
  storage: Pick<Storage, "getItem">,
  storageKey: string
): FloatingControlPosition | null => {
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FloatingControlPosition>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      Number.isNaN(parsed.x) ||
      Number.isNaN(parsed.y)
    ) {
      return null;
    }

    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
};

export const writeFloatingControlPosition = (
  storage: Pick<Storage, "setItem" | "removeItem">,
  storageKey: string,
  position: FloatingControlPosition | null
) => {
  if (!position) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(position));
};

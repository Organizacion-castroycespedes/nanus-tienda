import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from "react";

import {
  clampFloatingControlPosition,
  readFloatingControlPosition,
  resolveFloatingControlDefaultPosition,
  shouldTreatFloatingControlMovementAsDrag,
  snapFloatingControlPosition,
  writeFloatingControlPosition,
  type FloatingControlAnchor,
  type FloatingControlPosition,
  type FloatingControlSize,
} from "../utils/floating-control-position";

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: FloatingControlPosition;
  size: FloatingControlSize;
};

type UseDraggableFloatingControlOptions = {
  storageKey: string;
  defaultAnchor: FloatingControlAnchor;
  defaultSize: FloatingControlSize;
  minTop?: number;
  onActivate: () => void;
};

const getViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

export const useDraggableFloatingControl = ({
  storageKey,
  defaultAnchor,
  defaultSize,
  minTop = 96,
  onActivate,
}: UseDraggableFloatingControlOptions) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const ignoreNextClickRef = useRef(false);
  const positionRef = useRef<FloatingControlPosition | null>(null);
  const isDraggingRef = useRef(false);
  const [position, setPosition] = useState<FloatingControlPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncPosition = () => {
      const element = buttonRef.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const viewport = getViewport();
      const storedPosition = readFloatingControlPosition(window.localStorage, storageKey);

      setPosition((currentPosition) => {
        const basePosition =
          currentPosition ??
          storedPosition ??
          resolveFloatingControlDefaultPosition(defaultAnchor, viewport, rect, minTop);

        return clampFloatingControlPosition(basePosition, viewport, rect, minTop);
      });
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    return () => window.removeEventListener("resize", syncPosition);
  }, [defaultAnchor, minTop, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !position || isDragging) {
      return;
    }

    writeFloatingControlPosition(window.localStorage, storageKey, position);
  }, [isDragging, position, storageKey]);

  const updatePosition = useCallback(
    (nextPosition: FloatingControlPosition, size: FloatingControlSize) => {
      const viewport = getViewport();
      const clampedPosition = clampFloatingControlPosition(
        nextPosition,
        viewport,
        size,
        minTop
      );
      setPosition(clampedPosition);
      positionRef.current = clampedPosition;
    },
    [minTop]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || typeof window === "undefined") {
        return;
      }

      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const currentPosition =
        positionRef.current ??
        resolveFloatingControlDefaultPosition(
          defaultAnchor,
          getViewport(),
          rect,
          minTop
        );

      dragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPosition: currentPosition,
        size: {
          width: rect.width,
          height: rect.height,
        },
      };

      ignoreNextClickRef.current = false;

      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures. Drag still works with move events.
      }
    },
    [defaultAnchor, minTop]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || typeof window === "undefined") {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;

      if (!shouldTreatFloatingControlMovementAsDrag(deltaX, deltaY)) {
        return;
      }

      event.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      ignoreNextClickRef.current = true;

      updatePosition(
        {
          x: dragState.startPosition.x + deltaX,
          y: dragState.startPosition.y + deltaY,
        },
        dragState.size
      );
    },
    [updatePosition]
  );

  const finishPointerInteraction = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || typeof window === "undefined") {
        return;
      }

      dragStateRef.current = null;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }

      const currentPosition = positionRef.current ?? dragState.startPosition;
      if (isDraggingRef.current) {
        const snappedPosition = snapFloatingControlPosition(
          currentPosition,
          getViewport(),
          dragState.size,
          minTop
        );
        setPosition(snappedPosition);
        positionRef.current = snappedPosition;
      }

      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [minTop]
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      finishPointerInteraction(event);
      ignoreNextClickRef.current = false;
    },
    [finishPointerInteraction]
  );

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (ignoreNextClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        ignoreNextClickRef.current = false;
        return;
      }

      onActivate();
    },
    [onActivate]
  );

  return {
    buttonRef,
    buttonPosition: position,
    isDragging,
    buttonStyle: position
      ? {
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: "none" as const,
          userSelect: "none" as const,
          WebkitUserSelect: "none" as const,
          willChange: "left, top, transform" as const,
        }
      : {
          visibility: "hidden" as const,
        },
    buttonProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointerInteraction,
      onPointerCancel: handlePointerCancel,
      onClick: handleClick,
    },
  };
};

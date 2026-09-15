"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Modal } from "../../../components/design-system/Modal";

type PaymentDialogProps = {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
};

export const PaymentDialog = ({ title, busy, onClose, children }: PaymentDialogProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const container = containerRef.current;
    const focusable = container?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const elements = Array.from(container.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
      ));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div ref={containerRef} className="contents">
      <Modal
        title={title}
        size="xl"
        className="dark:bg-slate-950"
        contentClassName="max-w-5xl"
        responsive
        onClose={busy ? undefined : onClose}
      >
        {children}
      </Modal>
    </div>
  );
};

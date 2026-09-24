"use client";

import { MoreHorizontal } from "lucide-react";
import { Children, cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RowActionItem = {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

type MenuPosition = { top: number; left: number; openUpward: boolean };

export const runRowAction = (closeMenu: () => void, action: () => void) => {
  closeMenu();
  action();
};

export const calculateRowActionsMenuPosition = (
  buttonRect: Pick<DOMRect, "top" | "right" | "bottom">,
  viewport: Pick<Window, "innerHeight" | "innerWidth">,
  menuWidth = 208,
  menuHeight = 220,
): MenuPosition => {
  const gap = 4;
  const spaceBelow = viewport.innerHeight - buttonRect.bottom;
  const openUpward = spaceBelow < menuHeight && buttonRect.top > spaceBelow;
  const left = Math.min(Math.max(8, buttonRect.right - menuWidth), viewport.innerWidth - menuWidth - 8);

  return { top: openUpward ? buttonRect.top - gap : buttonRect.bottom + gap, left, openUpward };
};

type RowActionsMenuProps = {
  items?: RowActionItem[];
  children?: ReactNode;
  label?: string;
};

export const RowActionsMenu = ({ items = [], children, label = "Más acciones" }: RowActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeFirstChildren = (content: ReactNode): ReactNode => Children.map(content, (child) => {
    if (!isValidElement(child)) return child;

    const childProps = child.props as {
      children?: ReactNode;
      disabled?: boolean;
      onClick?: (event: MouseEvent<HTMLElement>) => void;
    };
    const nextChildren = childProps.children ? closeFirstChildren(childProps.children) : childProps.children;
    const nextProps: { children?: ReactNode; onClick?: (event: MouseEvent<HTMLElement>) => void } = {};

    if (childProps.onClick) {
      nextProps.onClick = (event) => {
        if (childProps.disabled) return;
        runRowAction(() => setOpen(false), () => childProps.onClick?.(event));
      };
    }
    if (nextChildren !== childProps.children) nextProps.children = nextChildren;

    return Object.keys(nextProps).length ? cloneElement(child, nextProps) : child;
  });

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    setMenuPosition(calculateRowActionsMenuPosition(buttonRef.current.getBoundingClientRect(), window));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menuItemClass = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700";
  const menu = open && menuPosition && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (!(event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End")) return;
            event.preventDefault();
            const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"], button') ?? []).filter((item) => !item.disabled);
            if (!menuItems.length) return;
            const current = menuItems.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? menuItems.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + menuItems.length) % menuItems.length;
            menuItems[next]?.focus();
          }}
          className="fixed z-[80] min-w-[208px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          style={{ top: menuPosition.openUpward ? undefined : menuPosition.top, bottom: menuPosition.openUpward ? window.innerHeight - menuPosition.top : undefined, left: menuPosition.left }}
        >
          {children ? <div className="flex flex-col gap-1 [&>button]:w-full [&>button]:justify-start [&>button]:text-left">{closeFirstChildren(children)}</div> : items.map((item, index) => (
            <div key={index}>
              {item.separatorBefore ? <div className="my-1 border-t border-slate-100 dark:border-slate-700" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`${menuItemClass} ${item.destructive ? "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40" : ""}`}
                onClick={() => {
                  if (item.disabled) return;
                  runRowAction(() => setOpen(false), item.onSelect);
                }}
              >
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative flex items-center justify-end gap-1">
      <button
        ref={buttonRef}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") && !open) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled), button:not(:disabled)')?.focus());
          }
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </div>
  );
};

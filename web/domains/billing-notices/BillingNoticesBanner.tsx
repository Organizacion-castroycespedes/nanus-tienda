"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { apiClient } from "../../lib/http";
import { useAppSelector } from "../../store/hooks";
import { canSeeBillingNotices, dismissKey, noticeMessage, noticeTone, todayInBogota, type BillingNotice } from "./notices";

const TONE_STYLES = {
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
};

const readDismissed = (key: string) => {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * Avisos de cobro de MANUS para los administradores del tenant. Si la consulta
 * falla o el usuario no es administrador, no se muestra nada.
 */
export const BillingNoticesBanner = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const [notices, setNotices] = useState<BillingNotice[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const allowed = canSeeBillingNotices(role);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    apiClient<{ items: BillingNotice[] }>("/billing-notices/active", { method: "GET" })
      .then((result) => {
        if (!active) return;
        setNotices(result.items ?? []);
        setDismissed(readDismissed(dismissKey(result.items ?? [])));
      })
      .catch(() => {
        if (active) setNotices([]);
      });
    return () => {
      active = false;
    };
  }, [allowed]);

  if (!allowed || notices.length === 0 || dismissed) return null;
  const today = todayInBogota();

  const hide = () => {
    try {
      window.sessionStorage.setItem(dismissKey(notices), "1");
    } catch {
      // Sin almacenamiento de sesión el aviso solo se oculta en esta vista.
    }
    setDismissed(true);
  };

  return (
    <section aria-label="Avisos de pago de MANUS" className="space-y-2">
      {notices.map((notice, index) => {
        const tone = noticeTone(notice.stage);
        const Icon = tone === "info" ? Info : AlertTriangle;
        return (
          <div key={notice.id} role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${TONE_STYLES[tone]}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="flex-1">
              {noticeMessage(notice, today)} Si ya pagaste, ignora este mensaje o comunícate con MANUS.
            </p>
            {index === 0 ? (
              <button type="button" onClick={hide} className="rounded-lg p-1 opacity-70 hover:opacity-100" aria-label="Ocultar avisos de pago">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

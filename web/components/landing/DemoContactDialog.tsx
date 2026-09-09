"use client";

import { useEffect, useRef } from "react";
import { Mail, MessageCircle, X } from "lucide-react";
import {
  CONTACT_INFO,
  getCommercialMailtoUrl,
  getCommercialWhatsAppUrl,
} from "../../lib/contact-info";

type DemoContactDialogProps = {
  open: boolean;
  onClose: () => void;
};

const DemoContactDialog = ({ open, onClose }: DemoContactDialogProps) => {
  const firstActionRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    firstActionRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby="demo-contact-title"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Cerrar solicitud de demo"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Solicita una demostración
            </p>
            <h2 id="demo-contact-title" className="mt-2 text-2xl font-bold">
              Elige cómo deseas comunicarte con nosotros.
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <a
            ref={firstActionRef}
            aria-label="Hablar con Manus POS por WhatsApp"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-green-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            href={getCommercialWhatsAppUrl()}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            WhatsApp
          </a>
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            href={getCommercialMailtoUrl()}
          >
            <Mail className="h-5 w-5" aria-hidden="true" />
            Correo electrónico
          </a>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          WhatsApp {CONTACT_INFO.phone} · {CONTACT_INFO.email}
        </p>
      </div>
    </div>
  );
};

export default DemoContactDialog;

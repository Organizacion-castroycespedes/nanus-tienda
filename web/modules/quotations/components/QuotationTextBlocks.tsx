"use client";

import { useEffect, useRef } from "react";
import type { QuotationTextBlocksValue } from "../types";

const SECTIONS: Array<{ key: keyof QuotationTextBlocksValue; title: string; label: string; placeholder: string }> = [
  {
    key: "commercialTerms",
    title: "Condiciones comerciales",
    label: "Contenido comercial",
    placeholder: "Ej.: 50% de anticipo y saldo contra entrega.",
  },
  {
    key: "paymentDeliveryTerms",
    title: "Forma de pago y entrega",
    label: "Pago y logística",
    placeholder: "Ej.: Entrega en 3 días hábiles en la dirección del cliente.",
  },
  {
    key: "warrantyTerms",
    title: "Garantía",
    label: "Garantía y soporte",
    placeholder: "Ej.: 6 meses por defectos de fabricación.",
  },
];

const AutoSizeTextarea = ({
  id,
  value,
  disabled,
  label,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.max(ref.current.scrollHeight, 140)}px`;
  }, [value]);

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
      <span className="font-medium">{label}</span>
      <textarea
        id={id}
        ref={ref}
        disabled={disabled}
        value={value}
        maxLength={5000}
        placeholder={disabled ? "" : placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[140px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
      />
    </label>
  );
};

/** Bloques de documentacion de la oferta (se imprimen en el PDF si tienen contenido). */
export const QuotationTextBlocks = ({
  value,
  readOnly = false,
  onChange,
}: {
  value: QuotationTextBlocksValue;
  readOnly?: boolean;
  onChange: (value: QuotationTextBlocksValue) => void;
}) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Documentación de la oferta</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Estos bloques aparecen en el PDF de la cotización cuando tienen contenido.
      </p>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      {SECTIONS.map((section) => (
        <article
          key={section.key}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{section.title}</h3>
          <AutoSizeTextarea
            id={`quotation-${section.key}`}
            label={section.label}
            placeholder={section.placeholder}
            disabled={readOnly}
            value={value[section.key]}
            onChange={(next) => onChange({ ...value, [section.key]: next })}
          />
        </article>
      ))}
    </div>
  </section>
);

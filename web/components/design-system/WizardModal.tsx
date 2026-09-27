"use client";

import React, { type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Check, AlertCircle, X } from "lucide-react";

export interface WizardStepConfig {
  key: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  optional?: boolean;
}

export interface WizardModalProps {
  open: boolean;
  title: string;
  description?: string;
  headerBadge?: ReactNode;
  steps: WizardStepConfig[];
  currentStepIndex: number;
  onStepClick?: (stepIndex: number) => void;
  onClose: () => void;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void | Promise<void>;
  canProceed?: boolean;
  canSubmit?: boolean;
  isSubmitting?: boolean;
  backText?: string;
  nextText?: string;
  submitText?: string;
  cancelText?: string;
  error?: string | null;
  onDismissError?: () => void;
  size?: "md" | "lg" | "xl" | "full";
  fullScreen?: boolean;
  children: ReactNode;
  customFooter?: ReactNode;
}

export const WizardModal: React.FC<WizardModalProps> = ({
  open,
  title,
  description,
  headerBadge,
  steps,
  currentStepIndex,
  onStepClick,
  onClose,
  onBack,
  onNext,
  onSubmit,
  canProceed = true,
  canSubmit = true,
  isSubmitting = false,
  backText = "Atrás",
  nextText = "Siguiente",
  submitText = "Guardar",
  cancelText = "Cancelar",
  error = null,
  onDismissError,
  size = "xl",
  fullScreen = false,
  children,
  customFooter,
}) => {
  if (!open) return null;

  const isLastStep = currentStepIndex >= steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <Modal
      title={title}
      description={description}
      size={size}
      fullScreen={fullScreen}
      responsive
      contentClassName={
        fullScreen
          ? "!rounded-none rounded-none !max-w-none !max-h-none !w-screen !h-screen !h-[100dvh] !border-0 flex flex-col p-4 sm:p-6"
          : "max-h-[92vh] sm:max-h-[88vh] flex flex-col"
      }
      bodyClassName="flex-1 min-h-0 overflow-y-auto pr-1"
      onClose={onClose}
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Step Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700/80">
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            {steps.map((step, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const Icon = step.icon;
              const isClickable = onStepClick && (isDone || isCurrent);

              return (
                <div key={step.key} className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick?.(idx)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                      isClickable ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isDone
                          ? "bg-emerald-600 text-white shadow-xs"
                          : isCurrent
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 shadow-xs"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                      ) : Icon ? (
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        isCurrent
                          ? "text-slate-900 font-semibold dark:text-white"
                          : isDone
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>

                  {idx < steps.length - 1 ? (
                    <div className="hidden sm:block h-0.5 w-4 lg:w-8 bg-slate-200 dark:bg-slate-700/80 mx-0.5" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {headerBadge ? <div className="shrink-0">{headerBadge}</div> : null}
        </div>

        {/* Embedded In-Modal Error Banner */}
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 flex items-start justify-between gap-3 shadow-2xs transition-all"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="font-medium break-words leading-relaxed">{error}</div>
            </div>
            {onDismissError ? (
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Cerrar mensaje de error"
                className="rounded-lg p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/50 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Wizard Step Body */}
        <div className="flex-1 min-h-0 py-1">{children}</div>

        {/* Wizard Footer Controls */}
        {customFooter ? (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80">{customFooter}</div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/80">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {cancelText}
            </Button>

            <div className="flex items-center gap-2">
              {!isFirstStep && onBack ? (
                <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
                  {backText}
                </Button>
              ) : null}

              {!isLastStep && onNext ? (
                <Button onClick={onNext} disabled={!canProceed || isSubmitting}>
                  {nextText}
                </Button>
              ) : null}

              {isLastStep && onSubmit ? (
                <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Procesando...
                    </span>
                  ) : (
                    submitText
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

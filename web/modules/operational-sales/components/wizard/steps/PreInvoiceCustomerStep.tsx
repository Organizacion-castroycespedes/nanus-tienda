"use client";

import React, { useEffect, useState } from "react";
import { User, AlertTriangle, CheckCircle2, Search, UserPlus, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../../../../../components/design-system/Button";
import { Input } from "../../../../../components/design-system/Input";
import { QuickFiscalCustomerModal } from "../../../../pos/components/QuickFiscalCustomerModal";
import {
  getCustomers,
  getCustomerById,
  type CustomerResponse,
} from "../../../../inventory/services/customer.service";
import type { OperationalSaleDetail } from "../../../types";

type PreInvoiceCustomerStepProps = {
  sale: OperationalSaleDetail;
  onCustomerUpdated: (sale: OperationalSaleDetail) => void;
  onNext: () => void;
  onSaveCustomer: (customerId: string) => Promise<OperationalSaleDetail>;
};

export const PreInvoiceCustomerStep: React.FC<PreInvoiceCustomerStepProps> = ({
  sale,
  onCustomerUpdated,
  onNext,
  onSaveCustomer,
}) => {
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<CustomerResponse | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(sale.customer.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false);

  // Load customer detail
  useEffect(() => {
    let active = true;
    setLoading(true);
    getCustomerById(sale.customer.id)
      .then((c) => {
        if (active) {
          setCurrentCustomer(c);
          setSelectedCustomerId(c.id);
        }
      })
      .catch(() => {
        // Fallback with minimal info
        if (active) {
          setCurrentCustomer({
            id: sale.customer.id,
            name: sale.customer.name ?? "Cliente sin nombre",
            tenantId: "",
            documentNumber: null,
            phone: null,
            email: null,
            address: null,
            departamentoId: null,
            municipioId: null,
            ciudad: null,
            departamento: null,
            isActive: true,
            createdAt: "",
            updatedAt: "",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sale.customer.id]);

  // Search customers catalog
  useEffect(() => {
    let active = true;
    setIsSearching(true);
    getCustomers({ query: searchQuery.trim() || undefined, limit: 10 })
      .then((list) => {
        if (active) setCustomers(list);
      })
      .catch(() => {
        if (active) setCustomers([]);
      })
      .finally(() => {
        if (active) setIsSearching(false);
      });
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const isSelectedDirty = selectedCustomerId !== sale.customer.id;

  const isFiscalComplete = Boolean(
    currentCustomer &&
      !currentCustomer.isFinalConsumer &&
      currentCustomer.documentNumber &&
      (currentCustomer.fiscalEmail || currentCustomer.email)
  );

  const handleSelectCustomer = async (c: CustomerResponse) => {
    setSelectedCustomerId(c.id);
    setCurrentCustomer(c);
    setError(null);
  };

  const handleSaveAndContinue = async () => {
    setError(null);
    if (isSelectedDirty) {
      setSaving(true);
      try {
        const updated = await onSaveCustomer(selectedCustomerId);
        onCustomerUpdated(updated);
        onNext();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar el cliente");
      } finally {
        setSaving(false);
      }
    } else {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {/* Current Customer Card */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {currentCustomer?.name ?? sale.customer.name ?? "Cliente sin nombre"}
                </span>
                {isSelectedDirty ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    Modificado
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentCustomer?.documentNumber
                  ? `CC / NIT: ${currentCustomer.documentNumber}`
                  : "Sin documento registrado"}
                {currentCustomer?.email || currentCustomer?.fiscalEmail
                  ? ` • ${currentCustomer.fiscalEmail || currentCustomer.email}`
                  : " • Sin correo fiscal"}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setFiscalModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            {currentCustomer?.isFinalConsumer ? "Convertir a cliente fiscal" : "Editar / Completar datos"}
          </Button>
        </div>

        {/* Fiscal readiness indicator */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          {isFiscalComplete ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Cliente con datos fiscales completos para Facturación Electrónica DIAN.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                {currentCustomer?.isFinalConsumer
                  ? "Este cliente está marcado como Consumidor Final. Si la factura tiene impuestos discriminados o el cliente requiere deducción fiscal, selecciona o crea un cliente fiscal."
                  : "Faltan datos fiscales requeridos por la DIAN (identificación o correo). Se recomienda completarlos para evitar rechazo."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search and Replace Customer */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-900 dark:text-white">
          Cambiar cliente de la venta
        </label>
        <div className="relative">
          <Input
            label="Buscar cliente"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o número de documento..."
            className="pl-9"
          />
          <Search className="absolute left-3 top-9 h-4 w-4 text-slate-400" />
        </div>

        {customers.length > 0 ? (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
            {customers.map((c) => {
              const isSelected = c.id === selectedCustomerId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void handleSelectCustomer(c)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {c.documentNumber ? `CC / NIT: ${c.documentNumber}` : "Sin documento"}
                      {c.email ? ` • ${c.email}` : ""}
                    </p>
                  </div>
                  {isSelected ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                </button>
              );
            })}
          </div>
        ) : searchQuery.trim() ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSearching ? "Buscando..." : "No se encontraron clientes con ese criterio."}
          </p>
        ) : null}
      </div>

      {/* Quick Fiscal Customer Modal */}
      {fiscalModalOpen ? (
        <QuickFiscalCustomerModal
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onClose={() => setFiscalModalOpen(false)}
          onCustomerSelected={(c) => {
            void handleSelectCustomer(c);
            setFiscalModalOpen(false);
          }}
          onCustomerSaved={async (saved) => {
            // Re-fetch customer to reflect new fiscal data
            try {
              const fullCustomer = await getCustomerById(saved.id);
              void handleSelectCustomer(fullCustomer);
            } catch {
              // Ignore reload error
            }
            setFiscalModalOpen(false);
          }}
        />
      ) : null}

      {/* Actions */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          onClick={() => void handleSaveAndContinue()}
          disabled={loading || saving}
          className="flex items-center gap-2"
        >
          {saving ? "Guardando cambios..." : "Continuar a Medios de Pago"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

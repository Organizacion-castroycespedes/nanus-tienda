import React, { useState } from "react";
import { Search, X, Check } from "lucide-react";
import type { FinancialInstitution } from "../../../finance/types";
import { BankLogo } from "../../../shared/payments/BankLogo";

type FinancialInstitutionSelectorProps = {
  institutions: FinancialInstitution[];
  selectedInstitutionId: string | null;
  onSelectInstitution: (id: string | null) => void;
  loading?: boolean;
};

export const FinancialInstitutionSelector: React.FC<FinancialInstitutionSelectorProps> = ({
  institutions,
  selectedInstitutionId,
  onSelectInstitution,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInstitutions = institutions.filter((inst) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inst.nombre.toLowerCase().includes(q) ||
      (inst.nombreCorto && inst.nombreCorto.toLowerCase().includes(q)) ||
      inst.codigo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Selecciona el banco o billetera
        </label>
        {selectedInstitutionId && (
          <button
            type="button"
            onClick={() => onSelectInstitution(null)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Limpiar selección
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar banco o billetera..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500">Cargando entidades...</div>
      ) : filteredInstitutions.length === 0 ? (
        <div className="py-3 text-center text-xs text-slate-500">
          No hay bancos o billeteras configurados para este medio de pago.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 max-h-56 overflow-y-auto pr-1">
          {filteredInstitutions.map((inst) => {
            const isSelected = selectedInstitutionId === inst.id;
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => onSelectInstitution(isSelected ? null : inst.id)}
                className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/90 ring-2 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/20 dark:ring-blue-500"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50"
                }`}
              >
                {isSelected && (
                  <div className="absolute right-1 top-1 rounded-full bg-blue-600 p-0.5 text-white">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
                <BankLogo code={inst.codigo} name={inst.nombre} logoUrl={inst.logoUrl} className="h-6 w-6" />
                <span className="line-clamp-1 text-[11px] font-medium leading-tight text-slate-800 dark:text-slate-200">
                  {inst.nombreCorto || inst.nombre}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Search, X, Check, Landmark, Smartphone, Building2 } from "lucide-react";
import type { FinancialInstitution } from "../../../finance/types";
import { BankLogo } from "../../../shared/payments/BankLogo";

type FinancialInstitutionSelectorProps = {
  institutions: FinancialInstitution[];
  selectedInstitutionId: string | null;
  onSelectInstitution: (id: string | null) => void;
  loading?: boolean;
};

type CategoryFilter = "ALL" | "WALLETS" | "BANKS";

const isWallet = (inst: FinancialInstitution) => {
  if (inst.tipo === "WALLET") return true;
  const text = `${inst.nombre} ${inst.nombreCorto || ""} ${inst.codigo}`.toLowerCase();
  return /nequi|daviplata|dale|movii|uala|tpaga|rappipay|lulo|wallet|billetera|transfiya/.test(text);
};

export const FinancialInstitutionSelector: React.FC<FinancialInstitutionSelectorProps> = ({
  institutions,
  selectedInstitutionId,
  onSelectInstitution,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // Deduplicate institutions by unique code/name
  const deduplicatedInstitutions = useMemo(() => {
    const seen = new Set<string>();
    const list: FinancialInstitution[] = [];
    for (const inst of institutions) {
      const key = (inst.codigo || inst.nombre).toUpperCase().trim().replace(/[-\s]/g, "_");
      if (!seen.has(key)) {
        seen.add(key);
        list.push(inst);
      }
    }
    return list;
  }, [institutions]);

  const { walletCount, bankCount } = useMemo(() => {
    let wallets = 0;
    let banks = 0;
    for (const inst of deduplicatedInstitutions) {
      if (isWallet(inst)) wallets++;
      else banks++;
    }
    return { walletCount: wallets, bankCount: banks };
  }, [deduplicatedInstitutions]);

  const filteredInstitutions = useMemo(() => {
    return deduplicatedInstitutions.filter((inst) => {
      // Category filter
      if (category === "WALLETS" && !isWallet(inst)) return false;
      if (category === "BANKS" && isWallet(inst)) return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inst.nombre.toLowerCase().includes(q) ||
        (inst.nombreCorto && inst.nombreCorto.toLowerCase().includes(q)) ||
        inst.codigo.toLowerCase().includes(q)
      );
    });
  }, [deduplicatedInstitutions, category, searchQuery]);

  const selectedInst = useMemo(
    () => deduplicatedInstitutions.find((i) => i.id === selectedInstitutionId),
    [deduplicatedInstitutions, selectedInstitutionId]
  );

  // Auto scroll to selected institution when opened
  useEffect(() => {
    if (selectedInstitutionId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedInstitutionId]);

  return (
    <div className="space-y-1.5">
      {/* Header with category pills in single row */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Banco / Billetera
          </label>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {filteredInstitutions.length}
          </span>
        </div>

        {/* Category Pills inline */}
        {walletCount > 0 && bankCount > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCategory("ALL")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                category === "ALL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setCategory("WALLETS")}
              className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                category === "WALLETS"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Smartphone className="h-2.5 w-2.5" />
              Billeteras
            </button>
            <button
              type="button"
              onClick={() => setCategory("BANKS")}
              className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                category === "BANKS"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Landmark className="h-2.5 w-2.5" />
              Bancos
            </button>
          </div>
        )}

        {selectedInst && (
          <button
            type="button"
            onClick={() => onSelectInstitution(null)}
            className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold ml-auto"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar banco o billetera..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-1 pl-7 pr-7 text-xs text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Institutions Grid (2 columns compact) */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500">Cargando entidades...</div>
      ) : filteredInstitutions.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          No hay resultados.
        </div>
      ) : (
        <div className="max-h-[145px] sm:max-h-[155px] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-1.5">
            {filteredInstitutions.map((inst) => {
              const isSelected = selectedInstitutionId === inst.id;
              const displayName = inst.nombreCorto || inst.nombre;

              return (
                <button
                  key={inst.id}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  title={inst.nombre}
                  onClick={() => onSelectInstitution(isSelected ? null : inst.id)}
                  className={`group relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center transition-all ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/90 font-semibold text-blue-700 ring-2 ring-blue-600 shadow-sm dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50/80 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                      <Check className="h-2 w-2" />
                    </div>
                  )}
                  <div className="flex h-5 w-full items-center justify-center px-1">
                    <BankLogo code={inst.codigo} name={inst.nombre} logoUrl={inst.logoUrl} className="h-5 w-auto max-h-5 max-w-[75px] object-contain" />
                  </div>
                  <span className="w-full truncate text-[10.5px] font-semibold leading-tight text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    {displayName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check, Landmark, Smartphone } from "lucide-react";
import type { FinancialInstitution } from "../../../finance/types";
import { BankLogo } from "../../../shared/payments/BankLogo";

type FinancialInstitutionSelectorProps = {
  institutions: FinancialInstitution[];
  selectedInstitutionId: string | null;
  onSelectInstitution: (id: string | null) => void;
  loading?: boolean;
  error?: string | null;
  maxVisible?: number;
};

type CategoryFilter = "ALL" | "WALLETS" | "BANKS";

const DEFAULT_MAX_VISIBLE = 8;

const isWallet = (inst: FinancialInstitution) => {
  if (inst.tipo === "WALLET") return true;
  const text = `${inst.nombre} ${inst.nombreCorto || ""} ${inst.codigo}`.toLowerCase();
  return /nequi|daviplata|dale|movii|uala|tpaga|rappipay|lulo|wallet|billetera|transfiya/.test(
    text
  );
};

export const FinancialInstitutionSelector: React.FC<FinancialInstitutionSelectorProps> = ({
  institutions,
  selectedInstitutionId,
  onSelectInstitution,
  loading = false,
  error = null,
  maxVisible = DEFAULT_MAX_VISIBLE,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [showAll, setShowAll] = useState(false);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const activeInstitutions = useMemo(
    () => institutions.filter((inst) => inst.active !== false),
    [institutions]
  );

  const deduplicatedInstitutions = useMemo(() => {
    const seen = new Set<string>();
    const list: FinancialInstitution[] = [];
    for (const inst of activeInstitutions) {
      const key = (inst.codigo || inst.nombre).toUpperCase().trim().replace(/[-\s]/g, "_");
      if (!seen.has(key)) {
        seen.add(key);
        list.push(inst);
      }
    }
    return list;
  }, [activeInstitutions]);

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
      if (category === "WALLETS" && !isWallet(inst)) return false;
      if (category === "BANKS" && isWallet(inst)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inst.nombre.toLowerCase().includes(q) ||
        (inst.nombreCorto && inst.nombreCorto.toLowerCase().includes(q)) ||
        inst.codigo.toLowerCase().includes(q)
      );
    });
  }, [deduplicatedInstitutions, category, searchQuery]);

  const visibleInstitutions = useMemo(() => {
    if (showAll || searchQuery.trim()) return filteredInstitutions;
    return filteredInstitutions.slice(0, maxVisible);
  }, [filteredInstitutions, showAll, searchQuery, maxVisible]);

  const hasMore = !searchQuery.trim() && !showAll && filteredInstitutions.length > maxVisible;

  const selectedInst = useMemo(
    () => deduplicatedInstitutions.find((i) => i.id === selectedInstitutionId),
    [deduplicatedInstitutions, selectedInstitutionId]
  );

  useEffect(() => {
    if (selectedInstitutionId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedInstitutionId]);

  useEffect(() => {
    setShowAll(false);
  }, [category, searchQuery]);

  const pillClass = (active: boolean) =>
    `min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:min-h-[36px] sm:px-2 sm:py-1 sm:text-[11px] ${
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    }`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Banco o billetera
          </label>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {filteredInstitutions.length}
          </span>
        </div>

        {selectedInst && (
          <button
            type="button"
            onClick={() => onSelectInstitution(null)}
            className="min-h-[44px] text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 sm:min-h-0 sm:text-[11px]"
          >
            Limpiar
          </button>
        )}
      </div>

      {walletCount > 0 && bankCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setCategory("ALL")} className={pillClass(category === "ALL")}>
            Todos
          </button>
          <button
            type="button"
            onClick={() => setCategory("WALLETS")}
            className={`flex items-center gap-1 ${pillClass(category === "WALLETS")}`}
          >
            <Smartphone className="h-3 w-3" />
            Billeteras
          </button>
          <button
            type="button"
            onClick={() => setCategory("BANKS")}
            className={`flex items-center gap-1 ${pillClass(category === "BANKS")}`}
          >
            <Landmark className="h-3 w-3" />
            Bancos
          </button>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar banco o billetera..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:min-h-[40px] sm:text-xs"
        />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500">Cargando entidades...</div>
      ) : filteredInstitutions.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">No hay resultados.</div>
      ) : (
        <div className={showAll || searchQuery.trim() ? "max-h-[220px] overflow-y-auto pr-1" : ""}>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {visibleInstitutions.map((inst) => {
              const isSelected = selectedInstitutionId === inst.id;
              const displayName = inst.nombreCorto || inst.nombre;

              return (
                <button
                  key={inst.id}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  title={inst.nombre}
                  aria-pressed={isSelected}
                  onClick={() => onSelectInstitution(isSelected ? null : inst.id)}
                  className={`group relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all sm:min-h-[72px] ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/90 font-semibold text-blue-700 ring-2 ring-blue-600 shadow-sm dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                  <div className="flex h-6 w-full items-center justify-center px-1">
                    <BankLogo
                      code={inst.codigo}
                      name={inst.nombre}
                      logoUrl={inst.logoUrl}
                      className="h-6 w-auto max-h-6 max-w-[80px] object-contain"
                    />
                  </div>
                  <span className="w-full truncate text-[11px] font-semibold leading-tight text-slate-700 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-300">
                    {displayName}
                  </span>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-blue-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700/50"
            >
              Ver todos los bancos ({filteredInstitutions.length})
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  );
};

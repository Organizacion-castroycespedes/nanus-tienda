import React, { useState } from "react";
import { Search, UserPlus, UserRound, X, CheckCircle2 } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";

type Customer = {
  id: string;
  name: string;
  documentNumber?: string | null;
};

type CustomerSectionProps = {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  onUseFinalConsumer: () => void;
  onOpenQuickFiscalCustomer: () => void;
  finalConsumerCustomer?: Customer | null;
};

export const CustomerSection: React.FC<CustomerSectionProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onUseFinalConsumer,
  onOpenQuickFiscalCustomer,
  finalConsumerCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(q) ||
      (customer.documentNumber && customer.documentNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 sm:p-3 dark:border-slate-700/80 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <UserRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Cliente de la venta</span>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onOpenQuickFiscalCustomer}
            className="h-7 rounded-lg border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <UserPlus className="h-3 w-3 mr-1 text-slate-500 dark:text-slate-400" />
            Cliente fiscal
          </Button>
          <Button
            variant={selectedCustomerId === finalConsumerCustomer?.id ? "primary" : "outline"}
            size="sm"
            type="button"
            onClick={onUseFinalConsumer}
            disabled={!finalConsumerCustomer}
            className={`h-7 rounded-lg px-2.5 text-xs font-medium ${
              selectedCustomerId === finalConsumerCustomer?.id
                ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            <UserRound className="h-3 w-3 mr-1" />
            Consumidor final
          </Button>
        </div>
      </div>

      {/* Customer search bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            placeholder={
              selectedCustomer
                ? `${selectedCustomer.name}${selectedCustomer.documentNumber ? ` (${selectedCustomer.documentNumber})` : ""}`
                : "Buscar cliente por nombre o documento..."
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => {
              setDropdownOpen(true);
            }}
            onBlur={() => {
              setTimeout(() => setDropdownOpen(false), 200);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          {(searchQuery || selectedCustomer) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                if (selectedCustomer && !searchQuery) {
                  onSelectCustomer("");
                }
                setDropdownOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            {filteredCustomers.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                No se encontraron clientes
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCustomers.map((customer) => {
                  const isSelected = selectedCustomerId === customer.id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomer(customer.id);
                        setSearchQuery("");
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-xs transition ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 font-medium"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="truncate">
                        {customer.name}
                        {customer.documentNumber && (
                          <span className="ml-1.5 text-[11px] opacity-70">({customer.documentNumber})</span>
                        )}
                      </span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

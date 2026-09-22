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
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        Cliente de la venta
      </div>

      <div className="space-y-3">
        <div className="relative">
          <div className="relative flex items-center">
            <input
              placeholder={selectedCustomer ? `${selectedCustomer.name}` : "Buscar cliente por nombre o documento..."}
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
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDropdownOpen(true);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
              {filteredCustomers.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
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
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 font-medium"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <span className="truncate">
                          {customer.name}
                          {customer.documentNumber && (
                            <span className="ml-1.5 text-xs opacity-70">({customer.documentNumber})</span>
                          )}
                        </span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onOpenQuickFiscalCustomer}
            className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          >
            <UserPlus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            Cliente fiscal
          </Button>
          <Button
            variant={selectedCustomerId === finalConsumerCustomer?.id ? "primary" : "ghost"}
            size="sm"
            type="button"
            onClick={onUseFinalConsumer}
            disabled={!finalConsumerCustomer}
            className="rounded-xl"
          >
            <UserRound className="h-4 w-4" />
            Consumidor final
          </Button>
        </div>
      </div>
    </div>
  );
};

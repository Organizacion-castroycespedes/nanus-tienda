"use client";

import { Check, Edit2, Plus, ShoppingBag, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { PosCartAccount } from "../../../../store/posCart";

type PosAccountTabsProps = {
  accounts: PosCartAccount[];
  activeAccountId: string;
  onSelectAccount?: (id: string) => void;
  onSwitchAccount?: (id: string) => void;
  onAddAccount: (options?: { name?: string }) => void;
  onRenameAccount: (payload: { id: string; name: string }) => void;
  onRemoveAccount: (id: string) => void;
  formatCurrency: (value: number) => string;
};

export const PosAccountTabs = ({
  accounts,
  activeAccountId,
  onSelectAccount,
  onSwitchAccount,
  onAddAccount,
  onRenameAccount,
  onRemoveAccount,
  formatCurrency,
}: PosAccountTabsProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<PosCartAccount | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelect = onSelectAccount ?? onSwitchAccount;

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (account: PosCartAccount, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditingId(account.id);
    setEditName(account.name);
  };

  const handleSaveRename = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      onRenameAccount({ id, name: trimmed });
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSaveRename(id);
    } else if (event.key === "Escape") {
      setEditingId(null);
    }
  };

  const handleCloseClick = (account: PosCartAccount, event: React.MouseEvent) => {
    event.stopPropagation();
    if (account.items.length > 0) {
      setConfirmDeleteAccount(account);
    } else {
      onRemoveAccount(account.id);
    }
  };

  return (
    <>
      <div className="flex w-full items-center gap-2 overflow-x-auto pb-0.5 text-sm no-scrollbar select-none">
        <div className="flex items-center gap-2 min-w-0">
          {accounts.map((account) => {
            const isActive = account.id === activeAccountId;
            const itemCount = account.items.reduce((sum, item) => sum + item.quantity, 0);
            const total = account.items.reduce(
              (sum, item) => sum + (item.lineTotal ?? item.price * item.quantity),
              0
            );
            const isEditing = editingId === account.id;

            return (
              <div
                key={account.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!isEditing && !isActive && handleSelect) {
                    handleSelect(account.id);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isEditing && !isActive && handleSelect) {
                    e.preventDefault();
                    handleSelect(account.id);
                  }
                }}
                className={`group relative inline-flex h-10 min-w-[7.5rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 font-medium transition-all duration-150 ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
                title={isActive ? "Cuenta activa (Doble clic para renombrar)" : `Cambiar a ${account.name}`}
                onDoubleClick={(e) => handleStartRename(account, e)}
              >
                {isEditing ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, account.id)}
                      onBlur={() => handleSaveRename(account.id)}
                      className="h-6 w-24 rounded border border-blue-400 bg-white px-1.5 text-xs text-slate-900 shadow-inner focus:outline-none dark:bg-slate-950 dark:text-white"
                      maxLength={24}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(account.id)}
                      className="rounded p-0.5 text-emerald-300 hover:bg-white/20"
                      title="Guardar nombre"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex max-w-[120px] items-center gap-2 truncate font-medium sm:max-w-[160px]">
                      <ShoppingBag className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />
                      {account.name}
                    </span>

                    {itemCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                        }`}
                      >
                        <span>{itemCount}</span>
                        <span className="opacity-60">•</span>
                        <span>{formatCurrency(total)}</span>
                      </span>
                    ) : null}

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(account, e)}
                      className={`rounded p-0.5 transition ${
                        isActive
                          ? "opacity-60 hover:opacity-100 hover:bg-white/20 text-white"
                          : "opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                      title="Renombrar cuenta"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>

                    {/* Close button if more than 1 account */}
                    {accounts.length > 1 ? (
                      <button
                        type="button"
                        onClick={(e) => handleCloseClick(account, e)}
                        className={`rounded p-0.5 transition ${
                          isActive
                            ? "opacity-60 hover:opacity-100 hover:bg-white/20 text-white"
                            : "opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-300 text-slate-500"
                        }`}
                        title="Cerrar cuenta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => onAddAccount()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 shrink-0"
            title="Abrir nueva cuenta"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Nueva cuenta</span>
          </button>
        </div>
      </div>

      {/* Modal de confirmacion al cerrar cuenta con productos */}
      {confirmDeleteAccount ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ¿Cerrar {confirmDeleteAccount.name}?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Esta cuenta contiene{" "}
              <strong className="text-slate-900 dark:text-white">
                {confirmDeleteAccount.items.reduce((s, i) => s + i.quantity, 0)} ítem(s)
              </strong>
              . Si la cierras, se descartarán los productos de esta cuenta.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveAccount(confirmDeleteAccount.id);
                  setConfirmDeleteAccount(null);
                }}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
              >
                Cerrar cuenta
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

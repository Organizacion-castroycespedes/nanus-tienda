"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Texto secundario visible (p. ej. SKU). También participa en la búsqueda. */
  description?: string | null;
  /** Términos extra de búsqueda no visibles. */
  keywords?: readonly string[];
};

type SearchableSelectProps = {
  label: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  /** Etiqueta de la opción vacía (`value=""`). Si se omite, no hay opción vacía. */
  emptyOptionLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  maxResults?: number;
  id?: string;
};

export const DEFAULT_SEARCHABLE_SELECT_MAX_RESULTS = 50;

/** Minúsculas y sin tildes, para comparar "Aguardiente" con "aguárdiente". */
export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Filtra por todas las palabras de la consulta (en cualquier orden) sobre
 * etiqueta, descripción y palabras clave. Prioriza coincidencias al inicio
 * de la etiqueta y conserva el orden original en lo demás.
 */
export const filterSearchableOptions = (
  options: readonly SearchableSelectOption[],
  query: string,
  limit = DEFAULT_SEARCHABLE_SELECT_MAX_RESULTS
): SearchableSelectOption[] => {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return options.slice(0, limit);

  const prefixMatches: SearchableSelectOption[] = [];
  const otherMatches: SearchableSelectOption[] = [];

  for (const option of options) {
    const label = normalizeSearchText(option.label);
    const haystack = [label, normalizeSearchText(option.description ?? ""), ...(option.keywords ?? []).map(normalizeSearchText)].join(" ");
    if (!terms.every((term) => haystack.includes(term))) continue;
    (label.startsWith(terms[0]) ? prefixMatches : otherMatches).push(option);
  }

  return [...prefixMatches, ...otherMatches].slice(0, limit);
};

/** Índice activo tras una tecla de navegación; -1 si no hay opciones. */
export const getNextActiveIndex = (key: string, current: number, total: number) => {
  if (total <= 0) return -1;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : Math.min(total - 1, current + 1);
    case "ArrowUp":
      return current < 0 ? total - 1 : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return current;
  }
};

export const SearchableSelect = ({
  label,
  value,
  options,
  onChange,
  emptyOptionLabel,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar",
  noResultsMessage = "Sin resultados",
  disabled = false,
  loading = false,
  hint,
  maxResults = DEFAULT_SEARCHABLE_SELECT_MAX_RESULTS,
  id,
}: SearchableSelectProps) => {
  const generatedId = useId();
  const baseId = id ?? `searchable-select-${generatedId.replace(/:/g, "")}`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);
  const triggerText = selected
    ? selected.label
    : value === "" && emptyOptionLabel
      ? emptyOptionLabel
      : placeholder;

  const visibleOptions = useMemo(() => {
    const matches = filterSearchableOptions(options, query, maxResults);
    return emptyOptionLabel && !query.trim()
      ? [{ value: "", label: emptyOptionLabel }, ...matches]
      : matches;
  }, [emptyOptionLabel, maxResults, options, query]);

  const totalMatches = useMemo(
    () => (query.trim() ? filterSearchableOptions(options, query, Number.MAX_SAFE_INTEGER).length : options.length),
    [options, query]
  );

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const selectedIndex = visibleOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : visibleOptions.length > 0 ? 0 : -1);
    // Solo al abrir: la navegación posterior la controla el teclado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: SearchableSelectOption) => {
    onChange(option.value);
    close();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActiveIndex((current) => getNextActiveIndex(event.key, current, visibleOptions.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
    }
  };

  const activeOptionId = activeIndex >= 0 && visibleOptions[activeIndex] ? `${baseId}-option-${activeIndex}` : undefined;
  const truncated = totalMatches > visibleOptions.filter((option) => option.value !== "" || !emptyOptionLabel).length;

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
      <span id={labelId} className="font-medium">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        id={`${baseId}-trigger`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${labelId} ${baseId}-trigger`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <span className={`min-w-0 truncate ${selected || (value === "" && emptyOptionLabel) ? "" : "text-slate-400"}`}>
          {loading ? "Cargando..." : triggerText}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-label={`Buscar ${label.toLowerCase()}`}
              value={query}
              placeholder={searchPlaceholder}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            aria-busy={loading}
            className="mt-2 max-h-60 overflow-y-auto overscroll-contain"
          >
            {visibleOptions.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-500 dark:text-slate-400" role="presentation">
                {loading ? "Cargando..." : noResultsMessage}
              </li>
            ) : (
              visibleOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={option.value || "__empty__"}
                    id={`${baseId}-option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-start justify-between gap-2 rounded-md px-2 py-1.5 ${
                      isActive ? "bg-blue-50 text-blue-900 dark:bg-slate-700 dark:text-white" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" /> : null}
                  </li>
                );
              })
            )}
          </ul>
          {truncated ? (
            <p className="mt-1 px-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              Mostrando {maxResults} de {totalMatches}. Escribe para afinar la búsqueda.
            </p>
          ) : null}
        </div>
      ) : null}

      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </div>
  );
};

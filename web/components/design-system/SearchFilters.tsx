import { Input } from "./Input";
import { Select } from "./Select";

type StatusOption = {
  value: string;
  label: string;
};

type SearchFiltersProps = {
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  queryLabel?: string;
  queryPlaceholder?: string;
  statusLabel?: string;
  statusOptions?: StatusOption[];
  className?: string;
};

export const SearchFilters = ({
  query,
  status,
  onQueryChange,
  onStatusChange,
  queryLabel = "Buscar",
  queryPlaceholder,
  statusLabel = "Estado",
  statusOptions,
  className,
}: SearchFiltersProps) => {
  const options = statusOptions ?? [
    { value: "all", label: "Todos" },
    { value: "active", label: "Activa" },
    { value: "inactive", label: "Inactiva" },
  ];

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className ?? ""}`}>
      <Input
        label={queryLabel}
        placeholder={queryPlaceholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <Select
        label={statusLabel}
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
};

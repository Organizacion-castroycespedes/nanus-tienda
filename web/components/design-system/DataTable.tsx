import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  className?: string;
};

export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error,
  emptyState,
  loadingState,
  className,
}: DataTableProps<T>) => {
  const colSpan = columns.length;

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
                  {loadingState ?? "Cargando informacion..."}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-rose-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyState ?? "No hay resultados para mostrar."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="align-top">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-4 text-sm text-slate-700 ${column.cellClassName ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

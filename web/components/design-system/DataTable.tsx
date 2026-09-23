import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  cellClassName?: string;
  actionFirst?: boolean;
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
  actionColumnFirst?: boolean;
};

export const orderDataTableColumns = <T,>(columns: DataTableColumn<T>[], actionColumnFirst = false) =>
  actionColumnFirst || columns.some((column) => column.actionFirst)
    ? [...columns].sort((left, right) => Number(left.key !== "actions") - Number(right.key !== "actions"))
    : columns;

export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error,
  emptyState,
  loadingState,
  className,
  actionColumnFirst = false,
}: DataTableProps<T>) => {
  const orderedColumns = orderDataTableColumns(columns, actionColumnFirst);
  const colSpan = orderedColumns.length;

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className ?? ""} dark:bg-slate-800 dark:border-slate-700`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {orderedColumns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 ${column.className ?? ""} dark:text-slate-400`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {emptyState ?? "No hay resultados para mostrar."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="align-top">
                  {orderedColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-4 text-sm text-slate-700 ${column.cellClassName ?? ""} dark:text-slate-200`}
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

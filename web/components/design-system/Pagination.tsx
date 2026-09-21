import { Button } from "./Button";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({ page, pageSize, totalItems, onPageChange }: PaginationProps) => {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800" aria-label="Paginación">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        Página {currentPage} de {totalPages} · {totalItems} registros
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>Anterior</Button>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</Button>
      </div>
    </nav>
  );
};

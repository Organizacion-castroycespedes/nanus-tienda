import { Button } from "./Button";
import { Select } from "./Select";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  loading?: boolean;
};

const PAGE_SIZES = [10, 25, 50, 100];

export const buildPaginationModel = (page: number, pageSize: number, totalItems: number) => {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    if (totalPages <= 5) return index + 1;
    if (currentPage <= 3) return index + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + index;
    return currentPage - 2 + index;
  });
  return { totalPages, currentPage, firstItem: totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1, lastItem: totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems), visiblePages };
};

export const Pagination = ({ page, pageSize, totalItems, onPageChange, onPageSizeChange, loading = false }: PaginationProps) => {
  const { totalPages, currentPage, firstItem, lastItem, visiblePages } = buildPaginationModel(page, pageSize, totalItems);
  const goTo = (nextPage: number) => onPageChange(Math.min(Math.max(nextPage, 1), totalPages));

  return (
    <nav className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Paginación">
      <span className="text-sm text-slate-500 dark:text-slate-400">Mostrando {firstItem}-{lastItem} de {totalItems} registros</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {onPageSizeChange ? <Select label="Filas" aria-label="Filas por página" value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="py-1.5">
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </Select> : null}
        <Button variant="ghost" size="sm" aria-label="Primera página" onClick={() => goTo(1)} disabled={loading || currentPage <= 1}>«</Button>
        <Button variant="ghost" size="sm" aria-label="Página anterior" onClick={() => goTo(currentPage - 1)} disabled={loading || currentPage <= 1}>‹</Button>
        {visiblePages.map((pageNumber) => <Button key={pageNumber} variant={pageNumber === currentPage ? "primary" : "ghost"} size="sm" aria-current={pageNumber === currentPage ? "page" : undefined} onClick={() => goTo(pageNumber)} disabled={loading}>{pageNumber}</Button>)}
        <Button variant="ghost" size="sm" aria-label="Página siguiente" onClick={() => goTo(currentPage + 1)} disabled={loading || currentPage >= totalPages}>›</Button>
        <Button variant="ghost" size="sm" aria-label="Última página" onClick={() => goTo(totalPages)} disabled={loading || currentPage >= totalPages}>»</Button>
      </div>
    </nav>
  );
};

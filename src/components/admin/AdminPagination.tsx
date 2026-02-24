import type { FC } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  itemCount: number;
  hasNextPage: boolean;
  loading?: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
};

const defaultPageSizes = [25, 50, 100];

const AdminPagination: FC<AdminPaginationProps> = ({
  page,
  pageSize,
  pageSizeOptions = defaultPageSizes,
  itemCount,
  hasNextPage,
  loading,
  onPageChange,
  onPageSizeChange,
}) => {
  const canGoPrev = page > 1;
  const canGoNext = hasNextPage;

  return (
    <div className="rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span className="font-semibold text-gray-700">Page {page}</span>
        <span>{itemCount} items</span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Rows</label>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-red-500 focus:outline-none"
            disabled={Boolean(loading)}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrev || Boolean(loading)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext || Boolean(loading)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPagination;

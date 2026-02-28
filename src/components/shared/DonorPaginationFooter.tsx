export function DonorPaginationFooter({
  currentPage,
  loading,
  hasNextPage,
  onPrev,
  onNext,
}: {
  currentPage: number;
  loading: boolean;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <span>Page {currentPage}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage === 1 || loading}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNextPage || loading}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

import { Archive, Trash2 } from 'lucide-react';

export function ArchiveDeleteActions({
  isArchived,
  onArchive,
  onDelete,
  deleteDisabled,
}: {
  isArchived: boolean;
  onArchive: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <>
      {isArchived ? (
        <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400">
          <Archive className="w-4 h-4" />
          Archived
        </span>
      ) : (
        <button
          type="button"
          onClick={onArchive}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <Archive className="w-4 h-4" />
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={Boolean(deleteDisabled)}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
          deleteDisabled
            ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
            : 'border-red-200 text-red-600 hover:bg-red-50'
        }`}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </>
  );
}


import { ModalShell } from './ModalShell';

type DeleteConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
  confirmText?: string;
  confirmingText?: string;
};

export function DeleteConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  isConfirming = false,
  confirmText = 'Delete',
  confirmingText = 'Deleting...',
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <ModalShell>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isConfirming ? confirmingText : confirmText}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

import { useState } from 'react';
import { ModalShell } from '../shared/ModalShell';

type ActionReasonModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

function ActionReasonModal({
  title,
  description,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: ActionReasonModalProps) {
  const [reason, setReason] = useState('');

  return (
    <ModalShell>
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-700">{description}</p>

      <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="action-reason">
        Reason
      </label>
      <textarea
        id="action-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Enter action reason"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
        rows={4}
      />

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={loading || reason.trim().length < 3}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

export default ActionReasonModal;

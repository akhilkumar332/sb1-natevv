import { ShieldCheck, UserCheck, UserMinus, UserX } from 'lucide-react';
import { normalizeUserStatus } from '../../utils/adminUserStatus';

type UserDetailQuickActionsProps = {
  canModify: boolean;
  verified?: boolean;
  status?: string | null;
  onAction: (action: 'verify' | 'active' | 'suspended' | 'inactive') => void;
};

function UserDetailQuickActions({ canModify, verified, status, onAction }: UserDetailQuickActionsProps) {
  const normalizedStatus = normalizeUserStatus(status);

  return (
    <section className="sticky top-2 z-20 rounded-2xl border border-red-100 bg-white p-3 shadow-sm">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-2">
          {!verified && (
            <button
              type="button"
              disabled={!canModify}
              onClick={() => onAction('verify')}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              Verify
            </button>
          )}
          {normalizedStatus !== 'active' && (
            <button
              type="button"
              disabled={!canModify}
              onClick={() => onAction('active')}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
            >
              <UserCheck className="h-4 w-4" />
              Set Active
            </button>
          )}
          {normalizedStatus !== 'suspended' && (
            <button
              type="button"
              disabled={!canModify}
              onClick={() => onAction('suspended')}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
            >
              <UserX className="h-4 w-4" />
              Suspend
            </button>
          )}
          {normalizedStatus !== 'inactive' && (
            <button
              type="button"
              disabled={!canModify}
              onClick={() => onAction('inactive')}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
            >
              <UserMinus className="h-4 w-4" />
              Deactivate
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default UserDetailQuickActions;

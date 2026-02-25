import type { AdminUserReferral } from '../../services/adminUserDetail.service';

type UserReferralGraphProps = {
  rows: AdminUserReferral[];
};

function UserReferralGraph({ rows }: UserReferralGraphProps) {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.referredRole || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900">Referral Role Distribution</h4>
      <div className="mt-3 space-y-2">
        {entries.length === 0 && <p className="text-xs text-gray-500">No referral graph data.</p>}
        {entries.map(([role, count]) => (
          <div key={role}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span className="capitalize">{role}</span>
              <span>{count}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.round((count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserReferralGraph;

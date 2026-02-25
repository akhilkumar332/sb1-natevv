import type { AdminUserKpis } from '../../services/adminUserDetail.service';

type UserKpiTrendProps = {
  kpis?: AdminUserKpis;
};

function UserKpiTrend({ kpis }: UserKpiTrendProps) {
  const trend = kpis?.trend || [];
  const values = trend.map((entry) => entry.value);
  const maxValue = Math.max(1, ...values);

  return (
    <div className="space-y-3">
      {trend.map((entry) => {
        const width = Math.round((entry.value / maxValue) * 100);
        return (
          <div key={entry.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>{entry.label}</span>
              <span>{entry.value}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
      {trend.length === 0 && <p className="text-sm text-gray-500">No trend data available.</p>}
    </div>
  );
}

export default UserKpiTrend;

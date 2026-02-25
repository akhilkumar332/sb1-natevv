import type { AdminUserKpis } from '../../services/adminUserDetail.service';

type UserKpiCardsProps = {
  kpis?: AdminUserKpis;
};

function UserKpiCards({ kpis }: UserKpiCardsProps) {
  const cards = kpis?.cards || [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
        </div>
      ))}
      {kpis?.cohort && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3">
          <p className="text-xs uppercase tracking-wide text-red-500">{kpis.cohort.label}</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{kpis.cohort.value}</p>
        </div>
      )}
      {cards.length === 0 && <p className="text-sm text-gray-500">No KPI data available.</p>}
    </div>
  );
}

export default UserKpiCards;

import type { AdminKpiRange } from '../../constants/adminQueryKeys';

type UserKpiRangeSelectorProps = {
  value: AdminKpiRange;
  onChange: (value: AdminKpiRange) => void;
};

function UserKpiRangeSelector({ value, onChange }: UserKpiRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">Range</span>
      {(['7d', '30d', '90d', '12m'] as AdminKpiRange[]).map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${value === range ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export default UserKpiRangeSelector;

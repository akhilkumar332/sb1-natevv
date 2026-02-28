type StatusTabOption<T extends string> = {
  id: T;
  label: string;
};

export function StatusTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<StatusTabOption<T>>;
}) {
  return (
    <>
      {options.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
            value === tab.id
              ? 'bg-red-600 text-white border-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </>
  );
}


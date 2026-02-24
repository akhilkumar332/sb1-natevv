import type { FC, ReactNode } from 'react';
import { Search } from 'lucide-react';

type AdminListToolbarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchPlaceholder?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
};

const AdminListToolbar: FC<AdminListToolbarProps> = ({
  searchTerm,
  onSearchTermChange,
  searchPlaceholder = 'Search...',
  leftContent,
  rightContent,
}) => {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-xl sm:p-5">
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
          <Search className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {leftContent ? <div className="flex flex-wrap items-center gap-2">{leftContent}</div> : <div />}
          {rightContent ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{rightContent}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default AdminListToolbar;

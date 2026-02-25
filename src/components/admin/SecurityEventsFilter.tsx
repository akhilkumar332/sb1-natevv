type SecurityEventsFilterProps = {
  kind: 'all' | 'impersonationEvents' | 'auditLogs';
  search: string;
  onKindChange: (value: 'all' | 'impersonationEvents' | 'auditLogs') => void;
  onSearchChange: (value: string) => void;
};

function SecurityEventsFilter({ kind, search, onKindChange, onSearchChange }: SecurityEventsFilterProps) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <select
        value={kind}
        onChange={(event) => onKindChange(event.target.value as 'all' | 'impersonationEvents' | 'auditLogs')}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
      >
        <option value="all">All Sources</option>
        <option value="impersonationEvents">Impersonation</option>
        <option value="auditLogs">Audit Logs</option>
      </select>
      <input
        type="text"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search IP or user-agent"
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
      />
    </div>
  );
}

export default SecurityEventsFilter;

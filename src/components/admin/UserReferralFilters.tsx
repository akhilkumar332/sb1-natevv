type UserReferralFiltersProps = {
  role: string;
  status: string;
  search: string;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

function UserReferralFilters({
  role,
  status,
  search,
  onRoleChange,
  onStatusChange,
  onSearchChange,
}: UserReferralFiltersProps) {
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3">
      <select
        value={role}
        onChange={(event) => onRoleChange(event.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
      >
        <option value="all">All roles</option>
        <option value="donor">Donor</option>
        <option value="ngo">NGO</option>
        <option value="bloodbank">BloodBank</option>
        <option value="hospital">Hospital</option>
      </select>
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
      >
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
        <option value="pending_verification">Pending Verification</option>
      </select>
      <input
        type="text"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search name or uid"
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
      />
    </div>
  );
}

export default UserReferralFilters;

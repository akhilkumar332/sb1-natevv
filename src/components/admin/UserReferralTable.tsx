import { Link } from 'react-router-dom';
import type { AdminUserReferral } from '../../services/adminUserDetail.service';

type UserReferralTableProps = {
  rows: AdminUserReferral[];
  formatDateTime: (value: any) => string;
  formatRole: (value?: string | null) => string;
};

function UserReferralTable({ rows, formatDateTime, formatRole }: UserReferralTableProps) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">No referrals found for this filter.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">UID</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Referred At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-2 text-gray-900 font-semibold">
                <Link to={`/admin/dashboard/users/${entry.referredUid}`} className="text-red-700 hover:underline">
                  {entry.referredName}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-600">{entry.referredUid}</td>
              <td className="px-3 py-2 text-gray-700 capitalize">{formatRole(entry.referredRole)}</td>
              <td className="px-3 py-2 text-gray-700 capitalize">{entry.referredStatus || entry.referralStatus || 'N/A'}</td>
              <td className="px-3 py-2 text-gray-600">{formatDateTime(entry.referredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserReferralTable;

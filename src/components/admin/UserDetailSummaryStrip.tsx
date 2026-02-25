type UserDetailSummaryStripProps = {
  status?: string;
  verified?: boolean;
  lastLoginLabel: string;
  timelineCount: number;
  referralCount: number;
};

function UserDetailSummaryStrip({
  status,
  verified,
  lastLoginLabel,
  timelineCount,
  referralCount,
}: UserDetailSummaryStripProps) {
  const risk = status === 'suspended' || !verified ? 'High' : 'Low';
  const health = status === 'active' && verified ? 'Healthy' : 'Needs Review';

  return (
    <section className="grid gap-3 rounded-2xl border border-red-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs uppercase text-gray-500">Risk Score</p>
        <p className="text-lg font-bold text-gray-900">{risk}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs uppercase text-gray-500">Account Health</p>
        <p className="text-lg font-bold text-gray-900">{health}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs uppercase text-gray-500">Trust</p>
        <p className="text-lg font-bold text-gray-900">{verified ? 'Verified' : 'Unverified'}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs uppercase text-gray-500">Last Activity</p>
        <p className="text-sm font-semibold text-gray-900">{lastLoginLabel}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs uppercase text-gray-500">Signals</p>
        <p className="text-sm font-semibold text-gray-900">{timelineCount} events, {referralCount} referrals</p>
      </div>
    </section>
  );
}

export default UserDetailSummaryStrip;

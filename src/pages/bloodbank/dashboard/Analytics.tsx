import { useOutletContext } from 'react-router-dom';
import { BloodBankAnalyticsDashboard } from '../../../components/analytics/BloodBankAnalyticsDashboard';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankAnalytics() {
  const { user } = useOutletContext<BloodBankDashboardContext>();

  return (
    <div className="space-y-6">
      {user?.uid ? (
        <BloodBankAnalyticsDashboard bloodBankId={user.uid} />
      ) : (
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500">
          Analytics are not available yet.
        </div>
      )}
    </div>
  );
}

export default BloodBankAnalytics;

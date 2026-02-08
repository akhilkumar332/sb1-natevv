import { useOutletContext } from 'react-router-dom';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankAccount() {
  const { user } = useOutletContext<BloodBankDashboardContext>();

  const profileFields = [
    { label: 'Contact person', value: user?.contactPersonName || user?.displayName },
    { label: 'BloodBank name', value: user?.bloodBankName || user?.hospitalName },
    { label: 'Registration', value: user?.registrationNumber },
    { label: 'BloodBank type', value: user?.bloodBankType || user?.hospitalType },
    { label: 'Email', value: user?.email },
    { label: 'Phone', value: user?.phoneNumber || user?.phone },
    { label: 'City', value: user?.city },
    { label: 'State', value: user?.state },
    { label: 'Address', value: user?.address },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Account</p>
        <h2 className="text-2xl font-bold text-gray-900">BloodBank profile</h2>
        <p className="text-sm text-gray-600 mt-1">Review your registration and contact details.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
        <div className="flex items-center gap-4">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-2xl object-cover border border-red-100"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?background=fff&color=dc2626&name=${encodeURIComponent(user?.displayName || 'BloodBank')}`;
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold">
              {(user?.displayName || 'B')[0]}
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-gray-900">{user?.bloodBankName || user?.hospitalName || 'BloodBank'}</h3>
            <p className="text-xs text-gray-500">BH ID: {user?.bhId || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{field.label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{field.value || 'Not set'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BloodBankAccount;

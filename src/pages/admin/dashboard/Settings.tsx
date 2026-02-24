import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const [values, setValues] = useState({
    enableEmergencyEscalation: true,
    enableVerificationNotifications: true,
    enableAuditRetentionReminder: true,
    dashboardAutoRefreshMinutes: 5,
  });

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bh_admin_settings', JSON.stringify(values));
    }
    toast.success('Admin settings saved locally.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">Admin Settings</h2>
        <p className="text-sm text-gray-600">Control admin operational defaults and safety settings.</p>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-700">Enable emergency escalation workflows</span>
          <input
            type="checkbox"
            checked={values.enableEmergencyEscalation}
            onChange={(event) => setValues((prev) => ({ ...prev, enableEmergencyEscalation: event.target.checked }))}
          />
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-700">Notify users on verification updates</span>
          <input
            type="checkbox"
            checked={values.enableVerificationNotifications}
            onChange={(event) => setValues((prev) => ({ ...prev, enableVerificationNotifications: event.target.checked }))}
          />
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-700">Enable audit retention reminders</span>
          <input
            type="checkbox"
            checked={values.enableAuditRetentionReminder}
            onChange={(event) => setValues((prev) => ({ ...prev, enableAuditRetentionReminder: event.target.checked }))}
          />
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-700">Dashboard auto refresh (minutes)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={values.dashboardAutoRefreshMinutes}
            onChange={(event) => setValues((prev) => ({ ...prev, dashboardAutoRefreshMinutes: Number(event.target.value || 5) }))}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900">Admin Navigation</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/admin/dashboard/audit-security" className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
            Open Audit & Security
          </Link>
          {isSuperAdmin && (
            <Link to="/admin/dashboard/impersonation-audit" className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
              Open Impersonation Audit
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

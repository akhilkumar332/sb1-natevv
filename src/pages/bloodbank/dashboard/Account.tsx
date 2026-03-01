import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { CheckCircle, MapPin, User, Building2, FileText } from 'lucide-react';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { updateUserNotificationPreferences } from '../../../services/offlineMutationOutbox.service';
import { captureHandledError } from '../../../services/errorLog.service';
import { ROUTES } from '../../../constants/routes';

function BloodBankAccount() {
  const { user } = useOutletContext<BloodBankDashboardContext>();
  const {
    permission: pushPermission,
    loading: pushLoading,
    requestPermission,
    unsubscribe,
  } = usePushNotifications();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setPushEnabled(user.notificationPreferences?.push !== false);
  }, [user?.notificationPreferences?.push, user]);

  const handlePushToggle = async () => {
    if (!user?.uid) return;
    const previousPushEnabled = pushEnabled;
    try {
      const wantsEnable = !pushEnabled;
      setPushMessage(null);
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPushMessage('Push notifications are not supported in this browser.');
        return;
      }

      if (wantsEnable) {
        await requestPermission();
        if (Notification.permission === 'granted') {
          setPushEnabled(true);
          const result = await updateUserNotificationPreferences({
            userId: user.uid,
            notificationPreferences: {
              ...(user.notificationPreferences || {}),
              push: true,
            },
          });
          if (result.queued) {
            setPushMessage('You are offline. This change will sync automatically.');
          }
        } else {
          setPushEnabled(false);
          const result = await updateUserNotificationPreferences({
            userId: user.uid,
            notificationPreferences: {
              ...(user.notificationPreferences || {}),
              push: false,
            },
          });
          if (result.queued) {
            setPushMessage('You are offline. This change will sync automatically.');
          }
          setPushMessage('Notifications are blocked. Enable them in your browser settings.');
        }
      } else {
        await unsubscribe();
        setPushEnabled(false);
        const result = await updateUserNotificationPreferences({
          userId: user.uid,
          notificationPreferences: {
            ...(user.notificationPreferences || {}),
            push: false,
          },
        });
        if (result.queued) {
          setPushMessage('You are offline. This change will sync automatically.');
        }
      }
    } catch (error) {
      setPushEnabled(previousPushEnabled);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'bloodbank',
        metadata: { kind: 'bloodbank.account.push.toggle' },
      });
      setPushMessage('Failed to update notification preference. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Account</p>
            <h2 className="text-2xl font-bold text-gray-900">BloodBank profile</h2>
            <p className="text-sm text-gray-500 mt-1">Review and update blood bank credentials.</p>
          </div>
          <User className="w-7 h-7 text-red-500" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <User className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {user?.contactPersonName || user?.displayName || 'BloodBank Admin'}
                </h3>
                <p className="text-xs text-gray-500">{user?.email || 'Email not set'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Role', value: 'BloodBank' },
                { label: 'BH ID', value: user?.bhId || 'Not assigned' },
                { label: 'Registration ID', value: user?.registrationNumber || 'Not set' },
                { label: 'Onboarding', value: user?.onboardingCompleted ? 'Completed' : 'Pending' },
                { label: 'Primary login', value: 'Google' },
                { label: 'Contact phone', value: user?.phoneNumber || user?.phone || 'Not set' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                >
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Link
                to={ROUTES.portal.bloodbank.onboarding}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:from-red-700 hover:to-yellow-700"
              >
                Update blood bank profile
                <CheckCircle className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 className="w-5 h-5 text-yellow-500" />
              BloodBank details
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">BloodBank name</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.bloodBankName || user?.hospitalName || 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">BloodBank type</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.bloodBankType || user?.hospitalType || 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Website</span>
                <span className="font-semibold text-gray-900 text-right">{user?.website || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Beds</span>
                <span className="font-semibold text-gray-900 text-right">{user?.numberOfBeds || 'Not set'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Description</span>
                <span className="font-semibold text-gray-900">{user?.description || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin className="w-5 h-5 text-yellow-500" />
              Location details
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Address</span>
                <span className="font-semibold text-gray-900">{user?.address || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">City / State</span>
                <span className="font-semibold text-gray-900 text-right">
                  {[user?.city, user?.state].filter(Boolean).join(', ') || 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Postal code</span>
                <span className="font-semibold text-gray-900">{user?.postalCode || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Country</span>
                <span className="font-semibold text-gray-900">{user?.country || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Coordinates</span>
                <span className="font-semibold text-gray-900">
                  {typeof user?.latitude === 'number' && typeof user?.longitude === 'number'
                    ? `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`
                    : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText className="w-5 h-5 text-yellow-500" />
              Compliance & contact
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Contact person</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.contactPersonName || user?.displayName || 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Date of birth</span>
                <span className="font-semibold text-gray-900">
                  {user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Email</span>
                <span className="font-semibold text-gray-900 text-right">{user?.email || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Phone</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.phoneNumber || user?.phone || 'Not set'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Privacy policy</span>
                <span className="font-semibold text-gray-900">
                  {user?.privacyPolicyAgreed ? 'Agreed' : 'Pending'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Terms of service</span>
                <span className="font-semibold text-gray-900">
                  {user?.termsOfServiceAgreed ? 'Agreed' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Notifications</p>
            <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
            <p className="text-xs text-gray-500 mt-1">Get alerts in your browser.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enable Push</p>
            <p className="text-xs text-gray-500">Receive inventory and request alerts.</p>
            {pushPermission === 'denied' && !pushMessage && (
              <p className="text-xs text-red-600 mt-1">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}
            {pushMessage && (
              <p className="text-xs text-red-600 mt-1">{pushMessage}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handlePushToggle}
            disabled={pushLoading}
            role="switch"
            aria-checked={pushEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
              pushEnabled ? 'bg-red-600' : 'bg-gray-300'
            } ${pushLoading ? 'opacity-60' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                pushEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export default BloodBankAccount;

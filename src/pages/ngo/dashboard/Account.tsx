import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router-dom';
import { CheckCircle, MapPin, User, Building2, FileText } from 'lucide-react';
import type { NgoDashboardContext } from '../NgoDashboard';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { updateUserNotificationPreferences } from '../../../services/offlineMutationOutbox.service';
import { captureHandledError } from '../../../services/errorLog.service';
import { ROUTES } from '../../../constants/routes';

function NgoAccount() {
  const { t } = useTranslation();
  const { user } = useOutletContext<NgoDashboardContext>();
  const {
    permission: pushPermission,
    loading: pushLoading,
    requestPermission,
    unsubscribe,
  } = usePushNotifications();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const notSet = t('common.notSet');

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
        setPushMessage(t('network.pushUnsupported'));
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
            setPushMessage(t('network.changeWillSyncAutomatically'));
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
            setPushMessage(t('network.changeWillSyncAutomatically'));
          }
          setPushMessage(t('network.notificationsBlocked'));
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
          setPushMessage(t('network.changeWillSyncAutomatically'));
        }
      }
    } catch (error) {
      setPushEnabled(previousPushEnabled);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'ngo',
        metadata: { kind: 'ngo.account.push.toggle' },
      });
      setPushMessage(t('network.updateNotificationPreferenceFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">{t('profile.account')}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t('profile.organizationProfile')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('profile.reviewNgoCredentials')}</p>
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
                  {user?.contactPersonName || user?.displayName || 'NGO Admin'}
                </h3>
                <p className="text-xs text-gray-500">{user?.email || t('common.noEmail')}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: t('profile.role'), value: t('portal.ngo') },
                { label: 'BH ID', value: user?.bhId || t('common.notAssigned') },
                { label: t('profile.registrationId'), value: user?.registrationNumber || notSet },
                { label: t('profile.onboarding'), value: user?.onboardingCompleted ? t('common.completed') : t('common.pending') },
                { label: t('profile.primaryLogin'), value: 'Google' },
                { label: t('profile.contactPhone'), value: user?.phoneNumber || user?.phone || notSet },
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
                to={ROUTES.portal.ngo.onboarding}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:from-red-700 hover:to-amber-700"
              >
                {t('profile.updateOrganizationProfile')}
                <CheckCircle className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 className="w-5 h-5 text-amber-500" />
              {t('profile.organizationDetails')}
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.organizationName')}</span>
                <span className="font-semibold text-gray-900 text-right">{user?.organizationName || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.ngoType')}</span>
                <span className="font-semibold text-gray-900 text-right">{user?.ngoType || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.yearEstablished')}</span>
                <span className="font-semibold text-gray-900 text-right">{user?.yearEstablished || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.website')}</span>
                <span className="font-semibold text-gray-900 text-right">{user?.website || notSet}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">{t('profile.description')}</span>
                <span className="font-semibold text-gray-900">{user?.description || notSet}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin className="w-5 h-5 text-amber-500" />
              {t('profile.locationDetails')}
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">{t('profile.address')}</span>
                <span className="font-semibold text-gray-900">{user?.address || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.cityState')}</span>
                <span className="font-semibold text-gray-900 text-right">
                  {[user?.city, user?.state].filter(Boolean).join(', ') || notSet}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.postalCode')}</span>
                <span className="font-semibold text-gray-900">{user?.postalCode || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.country')}</span>
                <span className="font-semibold text-gray-900">{user?.country || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.coordinates')}</span>
                <span className="font-semibold text-gray-900">
                  {typeof user?.latitude === 'number' && typeof user?.longitude === 'number'
                    ? `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`
                    : notSet}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText className="w-5 h-5 text-amber-500" />
              {t('profile.complianceContact')}
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.contactPerson')}</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.contactPersonName || user?.displayName || notSet}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.dateOfBirth')}</span>
                <span className="font-semibold text-gray-900">
                  {user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : notSet}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.email')}</span>
                <span className="font-semibold text-gray-900 text-right">{user?.email || notSet}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.phone')}</span>
                <span className="font-semibold text-gray-900 text-right">
                  {user?.phoneNumber || user?.phone || notSet}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.privacyPolicy')}</span>
                <span className="font-semibold text-gray-900">
                  {user?.privacyPolicyAgreed ? t('common.agreed') : t('common.pending')}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">{t('profile.termsOfService')}</span>
                <span className="font-semibold text-gray-900">
                  {user?.termsOfServiceAgreed ? t('common.agreed') : t('common.pending')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">{t('profile.notifications')}</p>
            <h3 className="text-lg font-semibold text-gray-900">{t('profile.pushNotifications')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('profile.getBrowserAlerts')}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">{t('profile.enablePush')}</p>
            <p className="text-xs text-gray-500">{t('profile.receiveNgoUpdates')}</p>
            {pushPermission === 'denied' && !pushMessage && (
              <p className="text-xs text-red-600 mt-1">
                {t('network.notificationsBlocked')}
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

export default NgoAccount;

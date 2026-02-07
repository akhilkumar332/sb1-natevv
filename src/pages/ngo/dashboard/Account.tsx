import { Link, useOutletContext } from 'react-router-dom';
import { CheckCircle, MapPin, User, Building2, FileText } from 'lucide-react';
import type { NgoDashboardContext } from '../NgoDashboard';

function NgoAccount() {
  const { user } = useOutletContext<NgoDashboardContext>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Account</p>
            <h2 className="text-2xl font-bold text-gray-900">Organization profile</h2>
            <p className="text-sm text-gray-500 mt-1">Review and update NGO credentials.</p>
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
                <p className="text-xs text-gray-500">{user?.email || 'Email not set'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Role', value: 'NGO' },
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
                to="/ngo/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:from-red-700 hover:to-amber-700"
              >
                Update organization profile
                <CheckCircle className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 className="w-5 h-5 text-amber-500" />
              Organization details
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Organization name</span>
                <span className="font-semibold text-gray-900 text-right">{user?.organizationName || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">NGO type</span>
                <span className="font-semibold text-gray-900 text-right">{user?.ngoType || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Year established</span>
                <span className="font-semibold text-gray-900 text-right">{user?.yearEstablished || 'Not set'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Website</span>
                <span className="font-semibold text-gray-900 text-right">{user?.website || 'Not set'}</span>
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
              <MapPin className="w-5 h-5 text-amber-500" />
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
              <FileText className="w-5 h-5 text-amber-500" />
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
    </div>
  );
}

export default NgoAccount;

import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Chrome, Phone, Share2, SlidersHorizontal, Trash2 } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { deleteUser } from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth, db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { normalizePhoneNumber } from '../../../utils/phone';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

const DonorAccount = () => {
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const dashboard = useOutletContext<any>();

  const {
    isLoading,
    user,
    availabilityEnabled,
    availabilitySaving,
    availabilityExpiryLabel,
    emergencyAlertsEnabled,
    emergencyAlertsSaving,
    handleAvailabilityToggle,
    handleEmergencyAlertsToggle,
    shareOptions,
    qrCodeDataUrl,
    normalizedLastDonation,
    formatDate,
    setShareOptionsOpen,
    handleShareDonorCard,
    shareCardLoading,
    setQrPreviewOpen,
    isPhoneLinked,
    canUnlinkPhone,
    unlinkPhoneLoading,
    handlePhoneUnlink,
    linkPhoneNumber,
    setLinkPhoneNumber,
    linkPhoneLoading,
    handlePhoneLinkStart,
    linkConfirmation,
    linkOtp,
    setLinkOtp,
    handlePhoneLinkConfirm,
    handlePhoneLinkResend,
    isGoogleLinked,
    canUnlinkGoogle,
    unlinkGoogleLoading,
    handleGoogleUnlink,
    linkGoogleLoading,
    handleGoogleLink,
  } = dashboard;

  const emailTarget = user?.email?.trim().toLowerCase() || '';
  const phoneTarget = user?.phoneNumber ? normalizePhoneNumber(user.phoneNumber) || user.phoneNumber : '';
  const inputValue = deleteConfirmInput.trim();
  const inputEmail = inputValue.toLowerCase();
  const inputPhone = normalizePhoneNumber(inputValue) || inputValue;
  const matchesEmail = Boolean(emailTarget && inputEmail === emailTarget);
  const matchesPhone = Boolean(phoneTarget && inputPhone === phoneTarget);
  const canConfirmDelete = matchesEmail || matchesPhone;

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete) {
      toast.error('Please enter your registered email or phone number.');
      return;
    }
    if (!auth.currentUser) {
      toast.error('No active session found. Please log in again.');
      return;
    }
    setDeleteLoading(true);
    try {
      const currentUserId = auth.currentUser.uid;
      await updateDoc(doc(db, 'users', currentUserId), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await deleteUser(auth.currentUser);
      await logout(navigate, { redirectTo: '/donor/login', showToast: false });
      toast.success('Account deleted successfully.');
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login') {
        toast.error('Please re-login and try again to delete your account.');
      } else {
        toast.error('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Account</p>
        <h2 className="text-xl font-bold text-gray-900">Manage profile and sharing</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-red-50 to-white p-4 shadow-lg transition-transform duration-300 hover:-translate-y-1 animate-fadeIn min-h-[260px] sm:min-h-0">
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-red-100/70 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-red-100/60 rounded-full blur-2xl"></div>
          {isLoading ? (
            <div className="relative space-y-5">
              <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-6 w-48 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              </div>
              <div className="h-6 w-28 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="relative space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-red-600">BloodHub Donor Card</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    {user?.displayName || 'Donor'}
                  </h2>
                  <p className="text-xs text-gray-500">{user?.city || 'Location not set'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    availabilityEnabled
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {availabilityEnabled ? 'Available' : 'On Break'}
                  </span>
                  <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                    Verified Donor
                  </span>
                  <div className="rounded-2xl bg-red-600 px-3 py-2 text-white text-lg font-bold shadow-lg">
                    {user?.bloodType || '—'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {shareOptions.showBhId && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">BH ID</p>
                    <p className="font-semibold text-gray-900">{user?.bhId || 'Pending'}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Last Donation</p>
                  <p className="font-semibold text-gray-900">
                    {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not recorded'}
                  </p>
                </div>
                {shareOptions.showPhone && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Phone</p>
                    <p className="font-semibold text-gray-900 text-xs break-all">
                      {user?.phoneNumber || 'Not set'}
                    </p>
                  </div>
                )}
                {shareOptions.showEmail && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Email</p>
                    <p className="font-semibold text-gray-900 text-xs break-all">
                      {user?.email || 'Not set'}
                    </p>
                  </div>
                )}
                {shareOptions.showQr && qrCodeDataUrl && (
                  <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-red-100 bg-white/80 px-3 py-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Share QR</p>
                      <p className="text-xs text-gray-600">Scan to open your donor profile link.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQrPreviewOpen(true)}
                      className="rounded-lg border border-red-100 bg-white p-1 transition-transform duration-300 hover:scale-105"
                      aria-label="Open QR preview"
                    >
                      <img
                        src={qrCodeDataUrl}
                        alt="BH ID QR"
                        className="h-12 w-12 shrink-0"
                      />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                <span>BloodHub India</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShareOptionsOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={handleShareDonorCard}
                    disabled={shareCardLoading}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Share2 className="w-3 h-3" />
                    {shareCardLoading ? 'Preparing' : 'Share Card'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Linked Accounts</h2>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Availability</p>
                    <p className="text-xs text-gray-500">Control emergency notifications.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAvailabilityToggle}
                    disabled={availabilitySaving}
                    role="switch"
                    aria-checked={availabilityEnabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                      availabilityEnabled ? 'bg-red-600' : 'bg-gray-300'
                    } ${availabilitySaving ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        availabilityEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {availabilityExpiryLabel && availabilityEnabled && (
                  <p className="text-[11px] text-gray-500">
                    Available until {availabilityExpiryLabel}
                  </p>
                )}
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Emergency Alerts</p>
                    <p className="text-xs text-gray-500">Get notified about urgent requests.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEmergencyAlertsToggle}
                    disabled={emergencyAlertsSaving || !availabilityEnabled}
                    role="switch"
                    aria-checked={emergencyAlertsEnabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                      emergencyAlertsEnabled ? 'bg-red-600' : 'bg-gray-300'
                    } ${emergencyAlertsSaving || !availabilityEnabled ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        emergencyAlertsEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-red-600" />
                    Phone
                  </span>
                  <span className={`text-xs font-semibold ${isPhoneLinked ? 'text-red-600' : 'text-gray-400'}`}>
                    {isPhoneLinked ? 'Linked' : 'Not linked'}
                  </span>
                </div>
                {isPhoneLinked && (
                  <button
                    type="button"
                    onClick={handlePhoneUnlink}
                    disabled={!canUnlinkPhone || unlinkPhoneLoading}
                    className="w-full py-2 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all duration-300 disabled:opacity-50"
                  >
                    {unlinkPhoneLoading ? 'Unlinking...' : 'Unlink Phone'}
                  </button>
                )}
                {!isPhoneLinked && (
                  <div className="space-y-3">
                    <PhoneInput
                      international
                      defaultCountry="IN"
                      countryCallingCodeEditable={false}
                      value={linkPhoneNumber}
                      onChange={(value) => setLinkPhoneNumber(value || '')}
                      className="block w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-sm"
                    />
                    <button
                      type="button"
                      onClick={handlePhoneLinkStart}
                      disabled={linkPhoneLoading}
                      className="w-full py-2 px-4 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                    >
                      {linkPhoneLoading ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                    {linkConfirmation && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={linkOtp}
                          onChange={(e) => setLinkOtp(e.target.value)}
                          maxLength={6}
                          placeholder="Enter OTP"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-center text-sm font-semibold tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={handlePhoneLinkConfirm}
                          disabled={linkPhoneLoading}
                          className="w-full py-2 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all duration-300 disabled:opacity-50"
                        >
                          {linkPhoneLoading ? 'Verifying...' : 'Verify & Link'}
                        </button>
                        <button
                          type="button"
                          onClick={handlePhoneLinkResend}
                          disabled={linkPhoneLoading}
                          className="w-full py-2 px-4 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300 disabled:opacity-50"
                        >
                          Resend OTP
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Chrome className="w-4 h-4 mr-2 text-red-600" />
                    Google
                  </span>
                  <span className={`text-xs font-semibold ${isGoogleLinked ? 'text-red-600' : 'text-gray-400'}`}>
                    {isGoogleLinked ? 'Linked' : 'Not linked'}
                  </span>
                </div>
                {isGoogleLinked && (
                  <button
                    type="button"
                    onClick={handleGoogleUnlink}
                    disabled={!canUnlinkGoogle || unlinkGoogleLoading}
                    className="w-full py-2 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all duration-300 disabled:opacity-50"
                  >
                    {unlinkGoogleLoading ? 'Unlinking...' : 'Unlink Google'}
                  </button>
                )}
                {!isGoogleLinked && (
                  <button
                    type="button"
                    onClick={handleGoogleLink}
                    disabled={linkGoogleLoading}
                    className="w-full py-2 px-4 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                  >
                    {linkGoogleLoading ? 'Linking...' : 'Link Google'}
                  </button>
                )}
              </div>
            )}
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-700">Delete Account</h3>
              <p className="text-xs text-red-700/80">This action is permanent and cannot be undone.</p>
            </div>
            <div className="rounded-full bg-red-50 p-2">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-xs text-red-700/80">
              Type your registered email or phone number to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => setDeleteConfirmInput(event.target.value)}
              placeholder="Email or phone number"
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={!canConfirmDelete || deleteLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DonorAccount;

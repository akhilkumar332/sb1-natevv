import i18n from '../i18n';

export const authMessages = {
  roleMismatch: {
    get donor() { return i18n.t('auth.roleMismatchDonor'); },
    get ngo() { return i18n.t('auth.roleMismatchNgo'); },
    get admin() { return i18n.t('auth.roleMismatchAdmin'); },
    get bloodbank() { return i18n.t('auth.roleMismatchBloodbank'); },
  },
  get superadminGoogleOnly() { return i18n.t('auth.superadminGoogleOnly'); },
  get onlySuperadminsCanImpersonate() { return i18n.t('auth.onlySuperadminsCanImpersonate'); },
  get unableToResolveSelectedUser() { return i18n.t('auth.unableToResolveSelectedUser'); },
  get impersonationFailed() { return i18n.t('auth.impersonationFailed'); },
  get failedToStartImpersonation() { return i18n.t('auth.failedToStartImpersonation'); },
  get failedToResumeAdminSession() { return i18n.t('auth.failedToResumeAdminSession'); },
  relogin: {
    get updateEmail() { return i18n.t('auth.reloginUpdateEmail'); },
    get updatePhone() { return i18n.t('auth.reloginUpdatePhone'); },
    get deleteAccount() { return i18n.t('auth.reloginDeleteAccount'); },
  },
  get recaptchaExpired() { return i18n.t('auth.recaptchaExpired'); },
};

export const referralMessages = {
  get unableToGenerateLink() { return i18n.t('referral.unableToGenerateLink'); },
  get unableToCopyLink() { return i18n.t('referral.unableToCopyLink'); },
  get unableToGenerateQr() { return i18n.t('referral.unableToGenerateQr'); },
};

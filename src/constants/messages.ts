export const authMessages = {
  roleMismatch: {
    donor: "You're not a Donor",
    ngo: "You're not an NGO",
    admin: "You're not an Admin",
    bloodbank: "You're not a BloodBank Admin",
  },
  superadminGoogleOnly: 'Superadmin can only sign in with Google.',
  onlySuperadminsCanImpersonate: 'Only superadmins can impersonate users.',
  unableToResolveSelectedUser: 'Unable to resolve the selected user.',
  impersonationFailed: 'Impersonation failed. Please try again.',
  failedToStartImpersonation: 'Failed to start impersonation.',
  failedToResumeAdminSession: 'Failed to resume admin session.',
  relogin: {
    updateEmail: 'Please re-login and try again to update your email.',
    updatePhone: 'Please re-login and try again to update your phone.',
    deleteAccount: 'Please re-login and try again to delete your account.',
  },
  recaptchaExpired: 'reCAPTCHA expired. Please try again.',
} as const;

export const referralMessages = {
  unableToGenerateLink: 'Unable to generate referral link.',
  unableToCopyLink: 'Unable to copy link. Please try again.',
  unableToGenerateQr: 'Unable to generate QR code.',
} as const;

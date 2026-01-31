export type ReferralRules = {
  eligibleAfterDays: number;
  excludeDeleted: boolean;
  requireOnboarding: boolean;
};

export type ReferralStatus = 'registered' | 'onboarded' | 'eligible' | 'deleted';

export const REFERRAL_RULES: ReferralRules = {
  eligibleAfterDays: 7,
  excludeDeleted: true,
  requireOnboarding: true,
};

export const normalizeReferralDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

export const computeReferralStatus = ({
  referredAt,
  referredUser,
  entryStatus,
  rules = REFERRAL_RULES,
}: {
  referredAt?: Date | null;
  referredUser?: any;
  entryStatus?: string;
  rules?: ReferralRules;
}) => {
  const createdAt = normalizeReferralDate(referredUser?.createdAt);
  const lastLoginAt = normalizeReferralDate(referredUser?.lastLoginAt);
  const baseDate = referredAt || createdAt || lastLoginAt;
  const ageDays = baseDate
    ? Math.floor((Date.now() - baseDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const isDeleted = referredUser?.status === 'deleted';
  const hasOnboarded = Boolean(referredUser?.onboardingCompleted);
  const meetsOnboarding = !rules.requireOnboarding || hasOnboarded;
  const meetsAge = typeof ageDays === 'number' && ageDays >= rules.eligibleAfterDays;
  const isEligible = !isDeleted && meetsOnboarding && meetsAge;
  const remainingDays = typeof ageDays === 'number'
    ? Math.max(0, rules.eligibleAfterDays - ageDays)
    : null;

  let status: ReferralStatus = 'registered';
  if (isDeleted && rules.excludeDeleted) {
    status = 'deleted';
  } else if (isEligible) {
    status = 'eligible';
  } else if (hasOnboarded) {
    status = 'onboarded';
  } else if (typeof entryStatus === 'string') {
    const normalized = entryStatus.toLowerCase();
    if (normalized === 'deleted') status = 'deleted';
    if (normalized === 'onboarded') status = 'onboarded';
    if (normalized === 'eligible') status = 'eligible';
  }

  const statusLabel = status === 'registered'
    ? 'Registered'
    : status === 'onboarded'
      ? 'Onboarded'
      : status === 'eligible'
        ? 'Eligible'
        : 'Deleted';

  return {
    status,
    statusLabel,
    isEligible,
    isDeleted,
    ageDays,
    remainingDays,
    baseDate,
  };
};

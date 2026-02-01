type PublicDonorInput = {
  uid?: string;
  bhId?: string | null;
  displayName?: string | null;
  name?: string | null;
  bloodType?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isAvailable?: boolean | null;
  availableUntil?: unknown;
  lastDonation?: unknown;
  donationType?: string;
  donationTypes?: string[];
  status?: string | null;
  onboardingCompleted?: boolean | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
  };
};

export const buildPublicDonorPayload = (donor: PublicDonorInput) => {
  const normalizeDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
    const parsed = new Date(value as any);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const latitude =
    typeof donor.latitude === 'number'
      ? donor.latitude
      : typeof donor.location?.latitude === 'number'
        ? donor.location.latitude
        : null;
  const longitude =
    typeof donor.longitude === 'number'
      ? donor.longitude
      : typeof donor.location?.longitude === 'number'
        ? donor.location.longitude
        : null;

  const availableUntilDate = normalizeDate(donor.availableUntil);
  const breakActive = Boolean(
    availableUntilDate && availableUntilDate.getTime() > Date.now()
  );
  const isAvailable = donor.isAvailable !== false && !breakActive;

  const payload: Record<string, unknown> = {
    uid: donor.uid,
    bhId: donor.bhId || null,
    displayName: donor.displayName || donor.name || null,
    bloodType: donor.bloodType || null,
    gender: donor.gender || null,
    city: donor.city || null,
    state: donor.state || null,
    address: donor.address || null,
    latitude,
    longitude,
    isAvailable,
    availableUntil: availableUntilDate || null,
    lastDonation: normalizeDate(donor.lastDonation),
    donationTypes: Array.isArray(donor.donationTypes) ? donor.donationTypes : null,
    donationType: donor.donationType || null,
    status: donor.status || 'active',
    onboardingCompleted: donor.onboardingCompleted !== false,
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  return payload;
};

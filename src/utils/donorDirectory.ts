import { documentId, endBefore, limit, limitToLast, orderBy, startAfter, where, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { DonorSummary } from '../hooks/useNgoData';

type DonorPageDirection = 'initial' | 'next' | 'prev';

type BuildConstraintsOptions = {
  bloodTypeFilter: string;
  availabilityFilter: string;
  cityFilter: string;
  direction: DonorPageDirection;
  pageSize: number;
  firstCursor?: string | QueryDocumentSnapshot | null;
  lastCursor?: string | QueryDocumentSnapshot | null;
};

const parseLatitude = (data: any): number | undefined => (
  typeof data?.latitude === 'number'
    ? data.latitude
    : typeof data?.location?.latitude === 'number'
      ? data.location.latitude
      : undefined
);

const parseLongitude = (data: any): number | undefined => (
  typeof data?.longitude === 'number'
    ? data.longitude
    : typeof data?.location?.longitude === 'number'
      ? data.location.longitude
      : undefined
);

export const mapDocToDonorSummary = (docOrRow: any): DonorSummary => {
  const data = docOrRow?.data ? docOrRow.data() : docOrRow;
  const latitude = parseLatitude(data);
  const longitude = parseLongitude(data);
  const fallbackIdSeed = [
    data?.uid,
    data?.id,
    data?.email,
    data?.phoneNumber,
    data?.name,
    latitude ?? '',
    longitude ?? '',
  ]
    .filter(Boolean)
    .join(':');
  return {
    id: docOrRow?.id || fallbackIdSeed || 'donor-unknown',
    name: data.displayName || data.name || 'Donor',
    email: data.email,
    phone: data.phoneNumber || data.phone,
    bloodType: data.bloodType,
    city: data.city,
    state: data.state,
    latitude,
    longitude,
    isAvailable: data.isAvailable,
    lastDonation: data.lastDonation?.toDate ? data.lastDonation.toDate() : data.lastDonation ? new Date(data.lastDonation) : undefined,
    totalDonations: data.totalDonations,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined,
  };
};

export const buildDonorQueryConstraints = (options: BuildConstraintsOptions): QueryConstraint[] => {
  // Donor directory for NGO/BloodBank is backed by publicDonors, so no role filter is needed.
  const constraints: QueryConstraint[] = [];

  if (options.bloodTypeFilter !== 'all') {
    constraints.push(where('bloodType', '==', options.bloodTypeFilter));
  }
  if (options.availabilityFilter !== 'all') {
    constraints.push(where('isAvailable', '==', options.availabilityFilter === 'available'));
  }
  if (options.cityFilter !== 'all') {
    constraints.push(where('city', '==', options.cityFilter));
  }

  constraints.push(orderBy(documentId()));

  if (options.direction === 'next' && options.lastCursor) {
    constraints.push(startAfter(options.lastCursor as any), limit(options.pageSize + 1));
  } else if (options.direction === 'prev' && options.firstCursor) {
    constraints.push(endBefore(options.firstCursor as any), limitToLast(options.pageSize + 1));
  } else {
    constraints.push(limit(options.pageSize + 1));
  }

  return constraints;
};

export const matchesDonorSearch = (donor: DonorSummary, term: string) => {
  const normalized = term.toLowerCase();
  return (
    donor.name.toLowerCase().includes(normalized)
    || donor.email?.toLowerCase().includes(normalized)
    || donor.city?.toLowerCase().includes(normalized)
    || donor.bloodType?.toLowerCase().includes(normalized)
  );
};

export const filterDonorRows = (
  donors: DonorSummary[],
  searchTerm: string,
  bloodTypeFilter?: string,
  availabilityFilter?: string,
  cityFilter?: string
) => {
  let results = donors;
  if (searchTerm.trim()) {
    results = results.filter((donor) => matchesDonorSearch(donor, searchTerm));
  }
  if (bloodTypeFilter && bloodTypeFilter !== 'all') {
    results = results.filter((donor) => donor.bloodType === bloodTypeFilter);
  }
  if (availabilityFilter && availabilityFilter !== 'all') {
    const shouldBeAvailable = availabilityFilter === 'available';
    results = results.filter((donor) => Boolean(donor.isAvailable) === shouldBeAvailable);
  }
  if (cityFilter && cityFilter !== 'all') {
    results = results.filter((donor) => donor.city === cityFilter);
  }
  return results;
};

export const donorCsvHeaders = [
  'Name',
  'Email',
  'Phone',
  'Blood Type',
  'City',
  'State',
  'Available',
  'Last Donation',
  'Total Donations',
];

export const donorCsvRows = (donors: DonorSummary[]) => donors.map((donor) => ([
  donor.name,
  donor.email || '',
  donor.phone || '',
  donor.bloodType || '',
  donor.city || '',
  donor.state || '',
  donor.isAvailable ? 'Yes' : 'No',
  donor.lastDonation ? donor.lastDonation.toLocaleDateString() : '',
  donor.totalDonations || '',
]));

export const donorCsvObjects = (donors: DonorSummary[]) => donorCsvRows(donors).map((row) => ({
  name: row[0],
  email: row[1],
  phone: row[2],
  bloodType: row[3],
  city: row[4],
  state: row[5],
  available: row[6],
  lastDonation: row[7],
  totalDonations: row[8],
}));

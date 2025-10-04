/**
 * Test Utilities
 *
 * This file provides mock data generators and utilities for testing.
 */

import { Timestamp } from 'firebase/firestore';
import {
  User,
  Donation,
  BloodRequest,
  Campaign,
  Appointment,
  Notification,
  Badge,
  UserBadge,
  VerificationRequest,
  BloodType,
  UserRole,
} from '../types/database.types';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate mock timestamp
 * @param daysAgo - Number of days in the past (default: 0 for now)
 * @returns Firestore Timestamp
 */
export const mockTimestamp = (daysAgo: number = 0): Timestamp => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return Timestamp.fromDate(date);
};

/**
 * Generate random ID
 * @returns Random string ID
 */
export const generateMockId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

/**
 * Generate mock donor user
 * @param overrides - Optional field overrides
 * @returns Mock donor user
 */
export const mockDonor = (overrides?: Partial<User>): User => {
  const id = generateMockId();
  return {
    uid: id,
    email: `donor${id}@test.com`,
    phoneNumber: '+919876543210',
    displayName: 'Test Donor',
    photoURL: null,
    role: 'donor',
    status: 'active',
    verified: true,
    createdAt: mockTimestamp(30),
    lastLoginAt: mockTimestamp(0),
    onboardingCompleted: true,
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    bloodType: 'O+',
    gender: 'Male',
    dateOfBirth: mockTimestamp(365 * 25), // 25 years old
    isAvailable: true,
    totalDonations: 5,
    donorLevel: 'Regular',
    impactScore: 500,
    ...overrides,
  };
};

/**
 * Generate mock hospital user
 * @param overrides - Optional field overrides
 * @returns Mock hospital user
 */
export const mockHospital = (overrides?: Partial<User>): User => {
  const id = generateMockId();
  return {
    uid: id,
    email: `hospital${id}@test.com`,
    phoneNumber: '+919876543211',
    displayName: 'Test Hospital',
    photoURL: null,
    role: 'hospital',
    status: 'active',
    verified: true,
    createdAt: mockTimestamp(60),
    lastLoginAt: mockTimestamp(0),
    onboardingCompleted: true,
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    hospitalName: 'Test General Hospital',
    hospitalType: 'government',
    licenseNumber: 'HSP12345',
    contactPerson: 'Dr. Test Admin',
    operatingHours: '24/7',
    facilities: ['Blood Bank', 'Emergency', 'ICU'],
    ...overrides,
  };
};

/**
 * Generate mock NGO user
 * @param overrides - Optional field overrides
 * @returns Mock NGO user
 */
export const mockNGO = (overrides?: Partial<User>): User => {
  const id = generateMockId();
  return {
    uid: id,
    email: `ngo${id}@test.com`,
    phoneNumber: '+919876543212',
    displayName: 'Test NGO',
    photoURL: null,
    role: 'ngo',
    status: 'active',
    verified: true,
    createdAt: mockTimestamp(90),
    lastLoginAt: mockTimestamp(0),
    onboardingCompleted: true,
    city: 'Delhi',
    state: 'Delhi',
    country: 'India',
    organizationName: 'Test Blood Donation Society',
    ngoType: 'registered',
    registrationNumber: 'NGO67890',
    foundedYear: 2010,
    mission: 'Promote voluntary blood donation',
    ...overrides,
  };
};

/**
 * Generate mock admin user
 * @param overrides - Optional field overrides
 * @returns Mock admin user
 */
export const mockAdmin = (overrides?: Partial<User>): User => {
  const id = generateMockId();
  return {
    uid: id,
    email: `admin${id}@test.com`,
    phoneNumber: '+919876543213',
    displayName: 'Test Admin',
    photoURL: null,
    role: 'admin',
    status: 'active',
    verified: true,
    createdAt: mockTimestamp(120),
    lastLoginAt: mockTimestamp(0),
    onboardingCompleted: true,
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    ...overrides,
  };
};

/**
 * Generate mock donation
 * @param overrides - Optional field overrides
 * @returns Mock donation
 */
export const mockDonation = (overrides?: Partial<Donation>): Donation => {
  const id = generateMockId();
  const donor = mockDonor();
  const hospital = mockHospital();

  return {
    id,
    donorId: donor.uid,
    donorName: donor.displayName || 'Test Donor',
    donorBloodType: donor.bloodType || 'O+',
    hospitalId: hospital.uid,
    hospitalName: hospital.hospitalName || 'Test Hospital',
    donationDate: mockTimestamp(7),
    units: 1,
    bloodType: 'O+',
    status: 'completed',
    medicalCheckPassed: true,
    hemoglobinLevel: 14.5,
    bloodPressure: '120/80',
    weight: 70,
    location: {
      city: 'Mumbai',
      state: 'Maharashtra',
    },
    createdAt: mockTimestamp(8),
    updatedAt: mockTimestamp(7),
    ...overrides,
  };
};

/**
 * Generate mock blood request
 * @param overrides - Optional field overrides
 * @returns Mock blood request
 */
export const mockBloodRequest = (overrides?: Partial<BloodRequest>): BloodRequest => {
  const id = generateMockId();
  const hospital = mockHospital();

  return {
    id,
    requesterId: hospital.uid,
    requesterName: hospital.hospitalName || 'Test Hospital',
    requesterType: 'hospital',
    bloodType: 'A+',
    units: 2,
    urgency: 'high',
    reason: 'Emergency surgery',
    patientName: 'Test Patient',
    patientAge: 35,
    status: 'active',
    unitsReceived: 0,
    unitsRequired: 2,
    location: {
      address: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.0760,
      longitude: 72.8777,
    },
    contactPerson: 'Dr. Emergency',
    contactPhone: '+919876543214',
    requestedAt: mockTimestamp(0),
    neededBy: mockTimestamp(-1), // Tomorrow
    expiresAt: mockTimestamp(-3), // 3 days from now
    respondedDonors: [],
    confirmedDonors: [],
    createdAt: mockTimestamp(0),
    updatedAt: mockTimestamp(0),
    isEmergency: true,
    ...overrides,
  };
};

/**
 * Generate mock campaign
 * @param overrides - Optional field overrides
 * @returns Mock campaign
 */
export const mockCampaign = (overrides?: Partial<Campaign>): Campaign => {
  const id = generateMockId();
  const ngo = mockNGO();

  return {
    id,
    ngoId: ngo.uid,
    ngoName: ngo.organizationName || 'Test NGO',
    title: 'Annual Blood Donation Drive',
    description: 'Join us for our annual blood donation campaign',
    type: 'blood-drive',
    target: 100,
    achieved: 45,
    targetType: 'donors',
    status: 'active',
    startDate: mockTimestamp(-7), // Started 7 days from now
    endDate: mockTimestamp(-37), // Ends 30 days from now
    location: {
      address: 'Community Center',
      city: 'Delhi',
      state: 'Delhi',
      venue: 'Main Hall',
    },
    registeredDonors: [],
    confirmedDonors: [],
    volunteers: [],
    partnerHospitals: [],
    createdAt: mockTimestamp(14),
    updatedAt: mockTimestamp(0),
    createdBy: ngo.uid,
    ...overrides,
  };
};

/**
 * Generate mock appointment
 * @param overrides - Optional field overrides
 * @returns Mock appointment
 */
export const mockAppointment = (overrides?: Partial<Appointment>): Appointment => {
  const id = generateMockId();
  const donor = mockDonor();
  const hospital = mockHospital();

  return {
    id,
    donorId: donor.uid,
    donorName: donor.displayName || 'Test Donor',
    donorBloodType: donor.bloodType || 'O+',
    donorPhone: donor.phoneNumber || '+919876543210',
    hospitalId: hospital.uid,
    hospitalName: hospital.hospitalName || 'Test Hospital',
    hospitalAddress: '123 Hospital Street, Mumbai',
    scheduledDate: mockTimestamp(-3), // 3 days from now
    scheduledTime: '10:00 AM',
    duration: 60,
    status: 'scheduled',
    purpose: 'regular_donation',
    reminderSent: false,
    createdAt: mockTimestamp(1),
    updatedAt: mockTimestamp(1),
    ...overrides,
  };
};

/**
 * Generate mock notification
 * @param overrides - Optional field overrides
 * @returns Mock notification
 */
export const mockNotification = (overrides?: Partial<Notification>): Notification => {
  const id = generateMockId();
  const donor = mockDonor();

  return {
    id,
    userId: donor.uid,
    userRole: 'donor',
    type: 'emergency_request',
    title: 'Emergency Blood Request',
    message: 'A+ blood needed urgently for emergency surgery',
    read: false,
    priority: 'high',
    createdAt: mockTimestamp(0),
    ...overrides,
  };
};

/**
 * Generate mock badge
 * @param overrides - Optional field overrides
 * @returns Mock badge
 */
export const mockBadge = (overrides?: Partial<Badge>): Badge => {
  const id = generateMockId();

  return {
    id,
    name: 'First Donation',
    description: 'Awarded for completing your first blood donation',
    icon: 'badge-1',
    category: 'milestone',
    criteria: {
      type: 'donation_count',
      threshold: 1,
    },
    rarity: 'common',
    pointsAwarded: 100,
    createdAt: mockTimestamp(365),
    ...overrides,
  };
};

/**
 * Generate mock user badge
 * @param overrides - Optional field overrides
 * @returns Mock user badge
 */
export const mockUserBadge = (overrides?: Partial<UserBadge>): UserBadge => {
  const id = generateMockId();
  const donor = mockDonor();
  const badge = mockBadge();

  return {
    id,
    userId: donor.uid,
    badgeId: badge.id || generateMockId(),
    earnedAt: mockTimestamp(7),
    earnedFor: 'Completed first donation',
    isDisplayed: true,
    displayOrder: 1,
    ...overrides,
  };
};

/**
 * Generate mock verification request
 * @param overrides - Optional field overrides
 * @returns Mock verification request
 */
export const mockVerificationRequest = (
  overrides?: Partial<VerificationRequest>
): VerificationRequest => {
  const id = generateMockId();
  const hospital = mockHospital({ verified: false, status: 'pending_verification' });

  return {
    id,
    userId: hospital.uid,
    organizationName: hospital.hospitalName || 'Test Hospital',
    organizationType: 'hospital',
    documents: [
      {
        type: 'license',
        name: 'hospital_license.pdf',
        url: 'https://example.com/license.pdf',
        uploadedAt: mockTimestamp(1),
      },
      {
        type: 'registration',
        name: 'registration_cert.pdf',
        url: 'https://example.com/registration.pdf',
        uploadedAt: mockTimestamp(1),
      },
    ],
    status: 'pending',
    location: {
      address: '123 Hospital Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
    },
    contactPerson: 'Dr. Admin',
    contactEmail: hospital.email || 'admin@hospital.com',
    contactPhone: hospital.phoneNumber || '+919876543215',
    submittedAt: mockTimestamp(1),
    updatedAt: mockTimestamp(1),
    ...overrides,
  };
};

// ============================================================================
// ARRAY GENERATORS
// ============================================================================

/**
 * Generate multiple mock items
 * @param generator - Mock data generator function
 * @param count - Number of items to generate
 * @returns Array of mock items
 */
export const generateMockArray = <T>(
  generator: (index: number) => T,
  count: number
): T[] => {
  return Array.from({ length: count }, (_, index) => generator(index));
};

/**
 * Generate mock donors array
 * @param count - Number of donors
 * @returns Array of mock donors
 */
export const mockDonors = (count: number = 10): User[] => {
  return generateMockArray(() => mockDonor(), count);
};

/**
 * Generate mock donations array
 * @param count - Number of donations
 * @returns Array of mock donations
 */
export const mockDonations = (count: number = 10): Donation[] => {
  return generateMockArray(() => mockDonation(), count);
};

/**
 * Generate mock blood requests array
 * @param count - Number of requests
 * @returns Array of mock blood requests
 */
export const mockBloodRequests = (count: number = 10): BloodRequest[] => {
  return generateMockArray(() => mockBloodRequest(), count);
};

/**
 * Generate mock campaigns array
 * @param count - Number of campaigns
 * @returns Array of mock campaigns
 */
export const mockCampaigns = (count: number = 5): Campaign[] => {
  return generateMockArray(() => mockCampaign(), count);
};

// ============================================================================
// FIRESTORE EMULATOR UTILITIES
// ============================================================================

/**
 * Check if Firestore emulator is available
 * @returns Boolean indicating if emulator is available
 */
export const isEmulatorAvailable = (): boolean => {
  return import.meta.env.VITE_USE_EMULATOR === 'true';
};

/**
 * Get emulator configuration
 * @returns Emulator config object
 */
export const getEmulatorConfig = () => {
  return {
    firestoreHost: 'localhost',
    firestorePort: 8080,
    authHost: 'localhost',
    authPort: 9099,
  };
};

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Wait for a specified amount of time
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after delay
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Random number between min and max
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random number
 */
export const randomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Random item from array
 * @param array - Array to pick from
 * @returns Random item
 */
export const randomItem = <T>(array: T[]): T => {
  return array[randomNumber(0, array.length - 1)];
};

/**
 * Random blood type
 * @returns Random blood type
 */
export const randomBloodType = (): BloodType => {
  const types: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  return randomItem(types);
};

/**
 * Random user role
 * @returns Random user role
 */
export const randomUserRole = (): UserRole => {
  const roles: UserRole[] = ['donor', 'hospital', 'ngo', 'admin'];
  return randomItem(roles);
};

/**
 * Database Type Definitions for BloodHub India
 *
 * This file contains TypeScript interfaces for all Firestore collections.
 * These types ensure type safety across the application and match the
 * database schema defined in DATABASE_ARCHITECTURE.md
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// COMMON TYPES
// ============================================================================

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Gender = 'Male' | 'Female' | 'Other';
export type UserRole = 'donor' | 'hospital' | 'ngo' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';
export type DonorLevel = 'New Donor' | 'Rookie' | 'Regular' | 'Super' | 'Hero' | 'Legend' | 'Champion';

// ============================================================================
// COLLECTION: users
// ============================================================================

/**
 * User interface representing all user types in the system
 * (Donors, Hospitals, NGOs, and Admins)
 */
export interface User {
  // Document ID (added by Firestore)
  id?: string;

  // Authentication Fields
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  photoURL: string | null;

  // Role & Status
  role: UserRole;
  status: UserStatus;
  verified: boolean;

  // Common Fields
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  onboardingCompleted: boolean;

  // Location
  address?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  location?: {
    latitude: number;
    longitude: number;
  };

  // Donor Specific Fields
  bloodType?: BloodType;
  gender?: Gender;
  dateOfBirth?: Timestamp;
  isAvailable?: boolean;
  lastDonation?: Timestamp;
  totalDonations?: number;
  medicalConditions?: string;
  occupation?: string;
  donorLevel?: DonorLevel;
  impactScore?: number;
  badges?: string[];

  // Hospital Specific Fields
  hospitalName?: string;
  hospitalType?: 'government' | 'private' | 'trust';
  licenseNumber?: string;
  contactPerson?: string;
  operatingHours?: string;
  facilities?: string[];

  // NGO Specific Fields
  organizationName?: string;
  ngoType?: 'registered' | 'trust' | 'society';
  registrationNumber?: string;
  foundedYear?: number;
  mission?: string;

  // Preferences
  preferredLanguage?: string;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    emergencyAlerts: boolean;
  };

  // Metadata
  howHeardAboutUs?: string;
  interestedInVolunteering?: boolean;
}

// ============================================================================
// COLLECTION: donations
// ============================================================================

export type DonationStatus = 'scheduled' | 'completed' | 'cancelled';

/**
 * Donation interface for tracking blood donation records
 */
export interface Donation {
  id?: string;
  donorId: string;
  donorName: string;
  donorBloodType: string;

  // Donation Details
  hospitalId: string;
  hospitalName: string;
  donationDate: Timestamp;
  units: number;
  bloodType: string;

  // Status
  status: DonationStatus;

  // Medical Info
  hemoglobinLevel?: number;
  bloodPressure?: string;
  weight?: number;
  medicalCheckPassed: boolean;

  // Tracking
  requestId?: string;
  campaignId?: string;

  // Location
  location: {
    city: string;
    state: string;
    latitude?: number;
    longitude?: number;
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

// ============================================================================
// COLLECTION: bloodRequests
// ============================================================================

export type BloodRequestStatus = 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled';
export type BloodRequestUrgency = 'critical' | 'high' | 'medium' | 'low';
export type RequesterType = 'hospital' | 'individual';

/**
 * BloodRequest interface for emergency and regular blood requests
 */
export interface BloodRequest {
  id?: string;

  // Requester Info
  requesterId: string;
  requesterName: string;
  requesterType: RequesterType;

  // Request Details
  bloodType: string;
  units: number;
  urgency: BloodRequestUrgency;
  reason?: string;
  patientName?: string;
  patientAge?: number;

  // Status
  status: BloodRequestStatus;
  unitsReceived: number;
  unitsRequired: number;

  // Location
  location: {
    address: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  };

  // Contact
  contactPerson: string;
  contactPhone: string;

  // Timing
  requestedAt: Timestamp;
  neededBy: Timestamp;
  expiresAt: Timestamp;
  fulfilledAt?: Timestamp;

  // Responses
  respondedDonors?: string[];
  confirmedDonors?: string[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isEmergency: boolean;
}

// ============================================================================
// COLLECTION: bloodInventory
// ============================================================================

export type InventoryStatus = 'adequate' | 'low' | 'critical' | 'surplus';
export type BatchStatus = 'available' | 'reserved' | 'expired' | 'used';

/**
 * BloodInventory interface for tracking blood stock at hospitals
 */
export interface BloodInventory {
  id?: string;
  hospitalId: string;

  // Blood Details
  bloodType: string;
  units: number;

  // Status
  status: InventoryStatus;

  // Expiry Tracking
  batches: Array<{
    batchId: string;
    units: number;
    collectionDate: Timestamp;
    expiryDate: Timestamp;
    status: BatchStatus;
  }>;

  // Thresholds
  criticalLevel: number;
  lowLevel: number;

  // Analytics
  averageMonthlyUsage: number;
  lastRestocked: Timestamp;

  // Metadata
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: campaigns
// ============================================================================

export type CampaignType = 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer';
export type CampaignStatus = 'draft' | 'active' | 'upcoming' | 'completed' | 'cancelled';
export type TargetType = 'units' | 'donors' | 'funds' | 'volunteers';

/**
 * Campaign interface for NGO campaigns and blood drives
 */
export interface Campaign {
  id?: string;

  // Campaign Info
  ngoId: string;
  ngoName: string;
  title: string;
  description: string;
  type: CampaignType;

  // Goals
  target: number;
  achieved: number;
  targetType: TargetType;

  // Status
  status: CampaignStatus;

  // Timing
  startDate: Timestamp;
  endDate: Timestamp;

  // Location
  location: {
    address: string;
    city: string;
    state: string;
    latitude?: number;
    longitude?: number;
    venue?: string;
  };

  // Participation
  registeredDonors?: string[];
  confirmedDonors?: string[];
  volunteers?: string[];

  // Media
  bannerImage?: string;
  images?: string[];

  // Partners
  partnerHospitals?: string[];
  partnerOrganizations?: string[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// COLLECTION: appointments
// ============================================================================

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
export type AppointmentPurpose = 'regular_donation' | 'emergency_request' | 'campaign';

/**
 * Appointment interface for scheduled donation appointments
 */
export interface Appointment {
  id?: string;

  // Participants
  donorId: string;
  donorName: string;
  donorBloodType: string;
  donorPhone: string;

  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;

  // Appointment Details
  scheduledDate: Timestamp;
  scheduledTime: string;
  duration: number;

  // Status
  status: AppointmentStatus;

  // Purpose
  purpose: AppointmentPurpose;
  relatedId?: string;

  // Reminders
  reminderSent: boolean;
  reminderSentAt?: Timestamp;

  // Completion
  donationId?: string;
  completedAt?: Timestamp;

  // Notes
  notes?: string;
  cancellationReason?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: volunteers
// ============================================================================

export type VolunteerRole = 'coordinator' | 'event_manager' | 'donor_relations' | 'general';
export type VolunteerStatus = 'active' | 'inactive';

/**
 * Volunteer interface for NGO volunteer management
 */
export interface Volunteer {
  id?: string;

  // Volunteer Info
  userId: string;
  name: string;
  email: string;
  phone: string;

  // NGO Association
  ngoId: string;
  ngoName: string;

  // Role
  role: VolunteerRole;
  status: VolunteerStatus;

  // Contribution
  hoursContributed: number;
  campaignsParticipated: number;
  eventsOrganized: number;

  // Skills
  skills?: string[];
  availability?: string;

  // Dates
  joinedAt: Timestamp;
  lastActiveAt: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: partnerships
// ============================================================================

export type PartnerType = 'hospital' | 'corporate' | 'community' | 'government';
export type PartnershipStatus = 'active' | 'pending' | 'inactive';

/**
 * Partnership interface for tracking partnerships between organizations
 */
export interface Partnership {
  id?: string;

  // Partners
  ngoId: string;
  ngoName: string;

  partnerId: string;
  partnerName: string;
  partnerType: PartnerType;

  // Partnership Details
  status: PartnershipStatus;
  startDate: Timestamp;
  endDate?: Timestamp;

  // Terms
  termsOfAgreement?: string;

  // Contribution Tracking
  totalDonations: number;
  totalCampaigns: number;
  totalFundsContributed?: number;

  // Contact
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: notifications
// ============================================================================

export type NotificationType =
  | 'emergency_request'
  | 'appointment_reminder'
  | 'campaign_invite'
  | 'donation_confirmation'
  | 'verification_status'
  | 'achievement'
  | 'general';

export type NotificationPriority = 'high' | 'medium' | 'low';

/**
 * Notification interface for user notifications and alerts
 */
export interface Notification {
  id?: string;

  // Recipient
  userId: string;
  userRole: string;

  // Notification Details
  type: NotificationType;
  title: string;
  message: string;

  // Status
  read: boolean;
  readAt?: Timestamp;

  // Action
  actionUrl?: string;
  actionLabel?: string;

  // Reference
  relatedId?: string;
  relatedType?: string;

  // Priority
  priority: NotificationPriority;

  // Metadata
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

// ============================================================================
// COLLECTION: badges
// ============================================================================

export type BadgeCategory = 'milestone' | 'achievement' | 'special';
export type BadgeCriteriaType =
  | 'donation_count'
  | 'streak'
  | 'campaign_participation'
  | 'emergency_response'
  | 'special_event';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Badge interface for gamification badges and achievements
 */
export interface Badge {
  id?: string;

  // Badge Info
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;

  // Criteria
  criteria: {
    type: BadgeCriteriaType;
    threshold?: number;
    condition?: string;
  };

  // Rarity
  rarity: BadgeRarity;

  // Points
  pointsAwarded: number;

  // Metadata
  createdAt: Timestamp;
}

// ============================================================================
// COLLECTION: userBadges
// ============================================================================

/**
 * UserBadge interface for tracking badges earned by users
 */
export interface UserBadge {
  id?: string;
  userId: string;
  badgeId: string;

  // Earned Details
  earnedAt: Timestamp;
  earnedFor?: string;

  // Display
  isDisplayed: boolean;
  displayOrder?: number;
}

// ============================================================================
// COLLECTION: verificationRequests
// ============================================================================

export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type DocumentType = 'license' | 'registration' | 'tax_certificate' | 'address_proof' | 'other';
export type OrganizationType = 'hospital' | 'ngo';

/**
 * VerificationRequest interface for tracking hospital/NGO verification requests
 */
export interface VerificationRequest {
  id?: string;

  // Organization Info
  userId: string;
  organizationName: string;
  organizationType: OrganizationType;

  // Documents
  documents: Array<{
    type: DocumentType;
    name: string;
    url: string;
    uploadedAt: Timestamp;
  }>;

  // Status
  status: VerificationStatus;

  // Admin Review
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  rejectionReason?: string;

  // Location
  location: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
  };

  // Contact
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;

  // Metadata
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: analytics
// ============================================================================

/**
 * Analytics interface for platform analytics data
 */
export interface Analytics {
  id?: string;
  date: Timestamp;

  // User Metrics
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  usersByRole: {
    donors: number;
    hospitals: number;
    ngos: number;
  };

  // Donation Metrics
  totalDonations: number;
  donationsByBloodType: {
    [key: string]: number;
  };
  donationsByCity: {
    [key: string]: number;
  };

  // Request Metrics
  totalRequests: number;
  fulfilledRequests: number;
  pendingRequests: number;
  averageResponseTime: number;

  // Campaign Metrics
  activeCampaigns: number;
  completedCampaigns: number;
  totalParticipation: number;

  // Inventory Metrics
  totalBloodUnits: number;
  criticalInventories: number;
  lowInventories: number;

  // Platform Health
  systemUptime: number;
  errorRate: number;

  // Generated At
  generatedAt: Timestamp;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Location type used across multiple collections
 */
export interface Location {
  address?: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Coordinates type for geolocation
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Type for Firestore document with ID
 */
export type WithId<T> = T & { id: string };

/**
 * Type for optional fields in create operations
 */
export type CreateData<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/**
 * Type for update operations (all fields optional except id)
 */
export type UpdateData<T> = Partial<Omit<T, 'id'>> & {
  id: string;
  updatedAt?: Timestamp;
};

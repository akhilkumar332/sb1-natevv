/**
 * Application Constants
 *
 * This file contains all constant values used throughout the application.
 * These constants ensure consistency and make it easy to update values globally.
 */

import {
  BloodType,
  UserRole,
  UserStatus,
  DonorLevel,
  DonationStatus,
  BloodRequestStatus,
  BloodRequestUrgency,
  InventoryStatus,
  CampaignType,
  CampaignStatus,
  AppointmentStatus,
  VolunteerRole,
  VolunteerStatus,
  PartnerType,
  PartnershipStatus,
  NotificationType,
  NotificationPriority,
  BadgeCategory,
  BadgeRarity,
  VerificationStatus,
  OrganizationType,
  DocumentType,
} from '../types/database.types';

// ============================================================================
// BLOOD TYPES
// ============================================================================

export const BLOOD_TYPES: readonly BloodType[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export const BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  'A+': 'A Positive (A+)',
  'A-': 'A Negative (A-)',
  'B+': 'B Positive (B+)',
  'B-': 'B Negative (B-)',
  'AB+': 'AB Positive (AB+)',
  'AB-': 'AB Negative (AB-)',
  'O+': 'O Positive (O+)',
  'O-': 'O Negative (O-)',
};

// Blood compatibility - who can receive from whom
export const BLOOD_COMPATIBILITY: Record<BloodType, BloodType[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // Universal receiver
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-'], // Universal donor
};

// ============================================================================
// USER ROLES
// ============================================================================

export const USER_ROLES: readonly UserRole[] = ['donor', 'bloodbank', 'hospital', 'ngo', 'admin'] as const;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  donor: 'Blood Donor',
  bloodbank: 'BloodBank',
  hospital: 'Hospital (Legacy)',
  ngo: 'NGO / Organization',
  admin: 'Administrator',
};

// ============================================================================
// USER STATUS
// ============================================================================

export const USER_STATUSES: readonly UserStatus[] = [
  'active',
  'inactive',
  'suspended',
  'pending_verification',
] as const;

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  pending_verification: 'Pending Verification',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  active: 'green',
  inactive: 'gray',
  suspended: 'red',
  pending_verification: 'yellow',
};

// ============================================================================
// DONOR LEVELS
// ============================================================================

export const DONOR_LEVELS: readonly DonorLevel[] = [
  'New Donor',
  'Rookie',
  'Regular',
  'Super',
  'Hero',
  'Legend',
  'Champion',
] as const;

export const DONOR_LEVEL_THRESHOLDS: Record<DonorLevel, number> = {
  'New Donor': 0,
  'Rookie': 1,
  'Regular': 5,
  'Super': 10,
  'Hero': 20,
  'Legend': 50,
  'Champion': 100,
};

export const DONOR_LEVEL_COLORS: Record<DonorLevel, string> = {
  'New Donor': 'gray',
  'Rookie': 'blue',
  'Regular': 'green',
  'Super': 'purple',
  'Hero': 'orange',
  'Legend': 'red',
  'Champion': 'gold',
};

// ============================================================================
// DONATION STATUS
// ============================================================================

export const DONATION_STATUSES: readonly DonationStatus[] = [
  'scheduled',
  'completed',
  'cancelled',
] as const;

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const DONATION_STATUS_COLORS: Record<DonationStatus, string> = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'red',
};

// ============================================================================
// BLOOD REQUEST STATUS
// ============================================================================

export const BLOOD_REQUEST_STATUSES: readonly BloodRequestStatus[] = [
  'active',
  'fulfilled',
  'partially_fulfilled',
  'expired',
  'cancelled',
] as const;

export const BLOOD_REQUEST_STATUS_LABELS: Record<BloodRequestStatus, string> = {
  active: 'Active',
  fulfilled: 'Fulfilled',
  partially_fulfilled: 'Partially Fulfilled',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const BLOOD_REQUEST_STATUS_COLORS: Record<BloodRequestStatus, string> = {
  active: 'blue',
  fulfilled: 'green',
  partially_fulfilled: 'yellow',
  expired: 'gray',
  cancelled: 'red',
};

// ============================================================================
// BLOOD REQUEST URGENCY
// ============================================================================

export const BLOOD_REQUEST_URGENCIES: readonly BloodRequestUrgency[] = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

export const BLOOD_REQUEST_URGENCY_LABELS: Record<BloodRequestUrgency, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const BLOOD_REQUEST_URGENCY_COLORS: Record<BloodRequestUrgency, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

// ============================================================================
// INVENTORY STATUS
// ============================================================================

export const INVENTORY_STATUSES: readonly InventoryStatus[] = [
  'adequate',
  'low',
  'critical',
  'surplus',
] as const;

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  adequate: 'Adequate',
  low: 'Low Stock',
  critical: 'Critical',
  surplus: 'Surplus',
};

export const INVENTORY_STATUS_COLORS: Record<InventoryStatus, string> = {
  adequate: 'green',
  low: 'yellow',
  critical: 'red',
  surplus: 'blue',
};

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export const CAMPAIGN_TYPES: readonly CampaignType[] = [
  'blood-drive',
  'awareness',
  'fundraising',
  'volunteer',
] as const;

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  'blood-drive': 'Blood Drive',
  'awareness': 'Awareness Campaign',
  'fundraising': 'Fundraising',
  'volunteer': 'Volunteer Recruitment',
};

// ============================================================================
// CAMPAIGN STATUS
// ============================================================================

export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  'draft',
  'active',
  'upcoming',
  'completed',
  'cancelled',
] as const;

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'gray',
  active: 'green',
  upcoming: 'blue',
  completed: 'purple',
  cancelled: 'red',
};

// ============================================================================
// APPOINTMENT STATUS
// ============================================================================

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no-show',
] as const;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No Show',
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'blue',
  confirmed: 'green',
  completed: 'purple',
  cancelled: 'red',
  'no-show': 'orange',
};

// ============================================================================
// VOLUNTEER ROLES
// ============================================================================

export const VOLUNTEER_ROLES: readonly VolunteerRole[] = [
  'coordinator',
  'event_manager',
  'donor_relations',
  'general',
] as const;

export const VOLUNTEER_ROLE_LABELS: Record<VolunteerRole, string> = {
  coordinator: 'Coordinator',
  event_manager: 'Event Manager',
  donor_relations: 'Donor Relations',
  general: 'General Volunteer',
};

// ============================================================================
// VOLUNTEER STATUS
// ============================================================================

export const VOLUNTEER_STATUSES: readonly VolunteerStatus[] = ['active', 'inactive'] as const;

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

// ============================================================================
// PARTNER TYPES
// ============================================================================

export const PARTNER_TYPES: readonly PartnerType[] = [
  'bloodbank',
  'hospital',
  'corporate',
  'community',
  'government',
] as const;

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  bloodbank: 'BloodBank',
  hospital: 'Hospital (Legacy)',
  corporate: 'Corporate',
  community: 'Community Organization',
  government: 'Government Agency',
};

// ============================================================================
// PARTNERSHIP STATUS
// ============================================================================

export const PARTNERSHIP_STATUSES: readonly PartnershipStatus[] = [
  'active',
  'pending',
  'inactive',
] as const;

export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'Inactive',
};

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'emergency_request',
  'donor_request',
  'appointment_reminder',
  'campaign_invite',
  'donation_confirmation',
  'verification_status',
  'achievement',
  'referral',
  'general',
] as const;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  emergency_request: 'Emergency Request',
  donor_request: 'Donor Request',
  appointment_reminder: 'Appointment Reminder',
  campaign_invite: 'Campaign Invitation',
  donation_confirmation: 'Donation Confirmation',
  verification_status: 'Verification Status',
  achievement: 'Achievement Unlocked',
  referral: 'Referral Update',
  general: 'General',
};

// ============================================================================
// NOTIFICATION PRIORITY
// ============================================================================

export const NOTIFICATION_PRIORITIES: readonly NotificationPriority[] = [
  'high',
  'medium',
  'low',
] as const;

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

// ============================================================================
// BADGE CATEGORIES
// ============================================================================

export const BADGE_CATEGORIES: readonly BadgeCategory[] = [
  'milestone',
  'achievement',
  'special',
] as const;

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestone: 'Milestone',
  achievement: 'Achievement',
  special: 'Special',
};

// ============================================================================
// BADGE RARITY
// ============================================================================

export const BADGE_RARITIES: readonly BadgeRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
] as const;

export const BADGE_RARITY_LABELS: Record<BadgeRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const BADGE_RARITY_COLORS: Record<BadgeRarity, string> = {
  common: 'gray',
  rare: 'blue',
  epic: 'purple',
  legendary: 'gold',
};

// ============================================================================
// VERIFICATION STATUS
// ============================================================================

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'pending',
  'under_review',
  'approved',
  'rejected',
] as const;

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, string> = {
  pending: 'yellow',
  under_review: 'blue',
  approved: 'green',
  rejected: 'red',
};

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export const ORGANIZATION_TYPES: readonly OrganizationType[] = ['bloodbank', 'hospital', 'ngo'] as const;

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  bloodbank: 'BloodBank',
  hospital: 'Hospital (Legacy)',
  ngo: 'NGO',
};

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'license',
  'registration',
  'tax_certificate',
  'address_proof',
  'other',
] as const;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  license: 'License',
  registration: 'Registration Certificate',
  tax_certificate: 'Tax Certificate',
  address_proof: 'Address Proof',
  other: 'Other',
};

// ============================================================================
// GENDER OPTIONS
// ============================================================================

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

// ============================================================================
// INDIAN STATES
// ============================================================================

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_VALUES = {
  // Donation
  DEFAULT_BLOOD_UNITS: 1,
  BLOOD_UNIT_ML: 450,
  MIN_DONATION_INTERVAL_DAYS: 90,
  MIN_DONOR_AGE: 18,
  MAX_DONOR_AGE: 65,
  MIN_DONOR_WEIGHT_KG: 50,

  // Inventory
  DEFAULT_CRITICAL_LEVEL: 5,
  DEFAULT_LOW_LEVEL: 10,
  BLOOD_EXPIRY_DAYS: 42,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Points & Gamification
  POINTS_PER_DONATION: 100,
  POINTS_PER_CAMPAIGN: 50,
  POINTS_PER_EMERGENCY_RESPONSE: 150,
  POINTS_PER_VOLUNTEER_HOUR: 10,

  // Notifications
  NOTIFICATION_EXPIRY_DAYS: 30,
  MAX_NOTIFICATIONS_DISPLAYED: 50,
} as const;

// ============================================================================
// HOSPITAL TYPES
// ============================================================================

export const HOSPITAL_TYPES = ['government', 'private', 'trust'] as const;

export const HOSPITAL_TYPE_LABELS: Record<typeof HOSPITAL_TYPES[number], string> = {
  government: 'Government BloodBank',
  private: 'Private BloodBank',
  trust: 'Trust BloodBank',
};

// ============================================================================
// NGO TYPES
// ============================================================================

export const NGO_TYPES = ['registered', 'trust', 'society'] as const;

export const NGO_TYPE_LABELS: Record<typeof NGO_TYPES[number], string> = {
  registered: 'Registered NGO',
  trust: 'Trust',
  society: 'Society',
};

// ============================================================================
// LANGUAGES
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
] as const;

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/,
  PHONE_WITH_CODE: /^\+91[6-9]\d{9}$/,
  POSTAL_CODE: /^[1-9][0-9]{5}$/,
  LICENSE_NUMBER: /^[A-Z0-9]{6,20}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid 10-digit phone number',
  INVALID_POSTAL_CODE: 'Please enter a valid 6-digit postal code',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and number',
  PASSWORD_MISMATCH: 'Passwords do not match',
  MIN_AGE: 'You must be at least 18 years old',
  MAX_AGE: 'Maximum age limit is 65 years',
  GENERIC_ERROR: 'An error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  PERMISSION_DENIED: 'You do not have permission to perform this action',
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profile updated successfully',
  DONATION_SCHEDULED: 'Donation scheduled successfully',
  REQUEST_CREATED: 'Blood request created successfully',
  CAMPAIGN_CREATED: 'Campaign created successfully',
  APPOINTMENT_BOOKED: 'Appointment booked successfully',
  VERIFICATION_SUBMITTED: 'Verification documents submitted successfully',
} as const;

// ============================================================================
// FEATURE FLAGS (for gradual rollout)
// ============================================================================

export const FEATURE_FLAGS = {
  ENABLE_EMAIL_AUTH: true,
  ENABLE_PHONE_AUTH: true,
  ENABLE_GOOGLE_AUTH: true,
  ENABLE_GAMIFICATION: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_ANALYTICS: true,
  ENABLE_GEOLOCATION: true,
} as const;

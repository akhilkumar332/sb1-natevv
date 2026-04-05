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
export type UserRole = 'donor' | 'bloodbank' | 'ngo' | 'admin' | 'superadmin' | 'hospital';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';
export type DonorLevel = 'New Donor' | 'Rookie' | 'Regular' | 'Super' | 'Hero' | 'Legend' | 'Champion';
export type StaffRole = 'viewer' | 'editor' | 'manager';

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
  phoneNumberNormalized?: string;
  displayName: string | null;
  photoURL: string | null;

  // Role & Status
  role: UserRole;
  status: UserStatus;
  verified: boolean;
  breakGlass?: boolean;
  staffRole?: StaffRole;
  parentHospitalId?: string;
  branchId?: string;

  // Common Fields
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  onboardingCompleted: boolean;
  bhId?: string;

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

  // BloodBank Specific Fields (legacy hospital fields retained for compatibility)
  bloodBankName?: string;
  bloodBankType?: 'government' | 'private' | 'trust';
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
  donorCardShareOptions?: {
    showPhone: boolean;
    showEmail: boolean;
    showBhId: boolean;
    showQr: boolean;
  };
  donorRequestTemplate?: {
    donationType: DonationComponent;
    message?: string;
  };
  findDonorsCompactMode?: boolean;
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
// COLLECTION: auditLogs
// ============================================================================

export interface AuditLog {
  id?: string;
  actorUid: string;
  actorRole: UserRole | string;
  action: string;
  targetUid?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}

// ============================================================================
// COLLECTION: impersonationEvents
// ============================================================================

export interface ImpersonationEvent {
  id?: string;
  actorUid: string;
  actorRole?: UserRole | string;
  targetUid?: string | null;
  action: string;
  status?: string | null;
  reason?: string | null;
  caseId?: string | null;
  metadata?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Timestamp;
}

// ============================================================================
// COLLECTION: errorLogs
// ============================================================================

export interface ErrorLog {
  id?: string;
  source: 'frontend' | 'functions' | 'netlify' | 'unknown';
  scope: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  level: 'error' | 'warning';
  message: string;
  code?: string | null;
  route?: string | null;
  stack?: string | null;
  userUid?: string | null;
  userRole?: UserRole | string | null;
  isImpersonating?: boolean;
  impersonationActorUid?: string | null;
  fingerprint?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
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
export type RequesterType = 'bloodbank' | 'individual' | 'hospital';

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
export type BatchSource = 'donation' | 'camp' | 'transfer' | 'other';
export type BatchTestStatus = 'pending' | 'passed' | 'failed';

/**
 * BloodInventory interface for tracking blood stock at hospitals
 */
export interface BloodInventory {
  id?: string;
  hospitalId: string;
  branchId?: string;

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
    source?: BatchSource;
    donorId?: string;
    reservationId?: string;
    reservedForRequestId?: string;
    reservedByUid?: string;
    testedStatus?: BatchTestStatus;
    notes?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
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

export type InventoryTransactionType =
  | 'add_batch'
  | 'adjust'
  | 'consume'
  | 'expire'
  | 'delete_batch'
  | 'transfer_out'
  | 'transfer_in'
  | 'reserve'
  | 'release';

export interface InventoryTransaction {
  id?: string;
  hospitalId: string;
  inventoryId: string;
  bloodType: string;
  type: InventoryTransactionType;
  deltaUnits: number;
  previousUnits: number;
  newUnits: number;
  batchId?: string;
  reservationId?: string;
  reason?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface InventoryTransfer {
  id?: string;
  fromHospitalId: string;
  toHospitalId: string;
  fromHospitalName?: string;
  toHospitalName?: string;
  fromBranchId?: string;
  toBranchId?: string;
  bloodType: string;
  units: number;
  status: 'pending' | 'sent' | 'received' | 'rejected' | 'cancelled';
  notes?: string;
  collectionDate?: Timestamp;
  expiryDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryAlert {
  id?: string;
  hospitalId: string;
  inventoryId: string;
  bloodType: string;
  batchId: string;
  alertType: 'expiry';
  daysToExpiry: number;
  status: 'open' | 'dismissed' | 'resolved';
  message?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryReservation {
  id?: string;
  hospitalId: string;
  branchId?: string;
  inventoryId: string;
  bloodType: string;
  units: number;
  requestId: string;
  requestStatus?: string;
  reservedBatchIds: string[];
  status: 'active' | 'released' | 'fulfilled' | 'expired';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  releasedAt?: Timestamp;
  fulfilledAt?: Timestamp;
}

export interface BloodBankBranch {
  id?: string;
  parentHospitalId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  isPrimary?: boolean;
  createdAt: Timestamp;
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
// COLLECTION: donorRequests
// ============================================================================

export type DonationComponent = 'whole' | 'platelets' | 'plasma';
export type DonorRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface DonorRequest {
  id?: string;

  requesterUid: string;
  requesterBhId?: string;
  requesterName?: string;
  requesterPhone?: string;
  requesterBloodType?: BloodType;

  targetDonorUid: string;
  targetDonorBhId?: string;
  targetDonorName?: string;
  targetDonorBloodType?: BloodType;
  targetDonorPhone?: string;

  donationType: DonationComponent;
  message?: string;

  status: DonorRequestStatus;
  requestedAt: Timestamp;
  respondedAt?: Timestamp;
  connectionExpiresAt?: Timestamp;
  connectionKey?: string;

  requesterLocation?: {
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  targetLocation?: {
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}

// ========================================================================
// COLLECTION: donorRequestBatches
// ========================================================================

export interface DonorRequestBatch {
  id?: string;
  requesterUid: string;
  requesterBhId?: string;
  requesterName?: string;
  requesterPhone?: string;
  requesterBloodType?: BloodType;
  donationType: DonationComponent;
  message?: string;
  targetCount: number;
  sentCount: number;
  skippedCount: number;
  deletedCount?: number;
  status: 'sending' | 'sent' | 'skipped' | 'failed' | 'cancelled';
  targetDonorIds: string[];
  skippedTargetIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COLLECTION: pendingDonorRequests
// ============================================================================

export interface PendingDonorRequest {
  id?: string;
  targetDonorId: string;
  targetDonorBhId?: string;
  targetDonorName: string;
  targetDonorBloodType: BloodType;
  targetLocation: string;
  donationType: DonationComponent;
  status?: 'pending';
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  updatedAt?: Timestamp;
  returnTo?: string;
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

export type PartnerType = 'bloodbank' | 'hospital' | 'corporate' | 'community' | 'government';
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
  | 'donor_request'
  | 'appointment_reminder'
  | 'campaign_invite'
  | 'donation_confirmation'
  | 'verification_status'
  | 'achievement'
  | 'referral'
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
  referralId?: string;
  referrerUid?: string;
  referredUid?: string;
  createdBy?: string;

  // Priority
  priority: NotificationPriority;

  // Metadata
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

// ============================================================================
// COLLECTION: contactSubmissions
// ============================================================================

export type ContactSubmissionStatus = 'unread' | 'read';

export interface ContactSubmission {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactSubmissionStatus;
  recaptchaScore?: number | null;
  recaptchaAction?: string | null;
  sourceIpHash?: string | null;
  userAgentHash?: string | null;
  readAt?: Timestamp | null;
  readBy?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// COLLECTION: npsResponses
// ============================================================================

export type NpsUserRole = 'donor' | 'ngo' | 'bloodbank';
export type NpsSegment = 'promoter' | 'passive' | 'detractor';
export type NpsFollowUpStatus = 'open' | 'in_progress' | 'closed';
export type NpsDriverTag =
  | 'support'
  | 'availability'
  | 'app_ux'
  | 'turnaround'
  | 'trust'
  | 'communication'
  | 'operations';

export interface NpsResponse {
  id?: string;
  userId: string;
  userRole: NpsUserRole;
  score: number;
  segment: NpsSegment;
  comment?: string | null;
  tags?: NpsDriverTag[];
  cycleKey: string;
  questionVersion: string;
  source: 'dashboard_prompt' | 'settings_feedback';
  followUpStatus?: NpsFollowUpStatus;
  followedUpBy?: string | null;
  followUpNotes?: string | null;
  followedUpAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface NpsPromptOverride {
  id?: string;
  userId: string;
  cycleKey: string;
  enabled: boolean;
  triggeredBy?: string | null;
  createdAt: Timestamp;
  lastTriggeredAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// COLLECTION: cmsPages, cmsBlogPosts, cmsBlogCategories, cmsNavMenus, cmsMedia, cmsSettings
// ============================================================================

export type CmsStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type CmsPageKind = 'generic' | 'home_section' | 'about_section' | 'contact_section';
export type CmsMenuLocation = 'header' | 'footer_resources' | 'footer_legal';
export interface TranslationOverrideMap {
  [key: string]: string | TranslationOverrideMap;
}

export interface CmsPage {
  id?: string;
  slug: string;
  title: string;
  titleByLocale?: Record<string, string> | null;
  kind: CmsPageKind;
  status: CmsStatus;
  contentJson?: string | null;
  contentJsonByLocale?: Record<string, string> | null;
  excerpt?: string | null;
  excerptByLocale?: Record<string, string> | null;
  seoTitle?: string | null;
  seoTitleByLocale?: Record<string, string> | null;
  seoDescription?: string | null;
  seoDescriptionByLocale?: Record<string, string> | null;
  seoCanonicalUrl?: string | null;
  seoNoIndex?: boolean;
  seoNoFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  coverImageUrl?: string | null;
  slugAliases?: string[];
  workflowAssignee?: string | null;
  reviewStatus?: 'not_requested' | 'in_review' | 'approved' | 'changes_requested';
  reviewNotes?: string | null;
  scheduledPublishAt?: Timestamp | null;
  scheduledUnpublishAt?: Timestamp | null;
  version?: number;
  publishedAt?: Timestamp | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsBlogCategory {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  colorHex?: string | null;
  status: CmsStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsBlogPost {
  id?: string;
  slug: string;
  title: string;
  titleByLocale?: Record<string, string> | null;
  excerpt?: string | null;
  excerptByLocale?: Record<string, string> | null;
  contentJson?: string | null;
  contentJsonByLocale?: Record<string, string> | null;
  categorySlug?: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  slugAliases?: string[];
  seriesSlug?: string | null;
  relatedPostSlugs?: string[];
  featuredUntil?: Timestamp | null;
  status: CmsStatus;
  featured?: boolean;
  seoTitle?: string | null;
  seoTitleByLocale?: Record<string, string> | null;
  seoDescription?: string | null;
  seoDescriptionByLocale?: Record<string, string> | null;
  seoCanonicalUrl?: string | null;
  seoNoIndex?: boolean;
  seoNoFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  authorName?: string | null;
  workflowAssignee?: string | null;
  reviewStatus?: 'not_requested' | 'in_review' | 'approved' | 'changes_requested';
  reviewNotes?: string | null;
  scheduledPublishAt?: Timestamp | null;
  scheduledUnpublishAt?: Timestamp | null;
  version?: number;
  publishedAt?: Timestamp | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsBlogPostSummary {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  categorySlug?: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  slugAliases?: string[];
  seriesSlug?: string | null;
  relatedPostSlugs?: string[];
  featuredUntil?: Timestamp | null;
  status: CmsStatus;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoIndex?: boolean;
  seoNoFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  authorName?: string | null;
  workflowAssignee?: string | null;
  reviewStatus?: 'not_requested' | 'in_review' | 'approved' | 'changes_requested';
  reviewNotes?: string | null;
  scheduledPublishAt?: Timestamp | null;
  scheduledUnpublishAt?: Timestamp | null;
  version?: number;
  publishedAt?: Timestamp | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsMenuItem {
  id: string;
  label: string;
  path: string;
  external?: boolean;
  order: number;
  enabled: boolean;
}

export interface CmsNavMenu {
  id?: string;
  location: CmsMenuLocation;
  status?: CmsStatus;
  items: CmsMenuItem[];
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsMedia {
  id?: string;
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  altText?: string | null;
  tags?: string[];
  status: CmsStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CmsSettings {
  id?: string;
  siteTitle: string;
  siteTagline?: string | null;
  defaultSeoTitle?: string | null;
  defaultSeoDescription?: string | null;
  canonicalBaseUrl?: string | null;
  defaultOgImageUrl?: string | null;
  twitterHandle?: string | null;
  robotsPolicy?: 'index_follow' | 'noindex_nofollow';
  blogPostsPerPage: number;
  showFeaturedOnBlog: boolean;
  showBlogInFooter: boolean;
  requireApprovalBeforePublish?: boolean;
  supportEmail?: string | null;
  supportPhone?: string | null;
  officeCity?: string | null;
  socialLinks?: Record<string, string>;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TranslationOverrideDocument {
  id?: string;
  language: string;
  translations: TranslationOverrideMap;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string | null;
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
export type OrganizationType = 'bloodbank' | 'hospital' | 'ngo';

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
  newDonors?: number;
  activeUsers: number;
  usersByRole: {
    donors: number;
    hospitals: number;
    ngos: number;
  };

  // Donation Metrics
  totalDonations: number;
  newDonations?: number;
  donationsByBloodType: {
    [key: string]: number;
  };
  donationsByCity: {
    [key: string]: number;
  };

  // Request Metrics
  totalRequests: number;
  newRequests?: number;
  fulfilledRequests: number;
  pendingRequests: number;
  averageResponseTime: number;

  // Campaign Metrics
  activeCampaigns: number;
  completedCampaigns: number;
  newCampaigns?: number;
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

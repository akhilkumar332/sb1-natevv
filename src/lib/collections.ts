/**
 * Firestore Collection References
 *
 * This file provides typed collection references for all Firestore collections.
 * It ensures type safety when performing database operations.
 */

import {
  collection,
  CollectionReference,
  doc,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  User,
  Donation,
  BloodRequest,
  BloodInventory,
  Campaign,
  Appointment,
  Volunteer,
  Partnership,
  Notification,
  Badge,
  UserBadge,
  VerificationRequest,
  Analytics,
} from '../types/database.types';
import { createConverter } from '../utils/firestore.utils';

// ============================================================================
// COLLECTION NAMES
// ============================================================================

export const COLLECTIONS = {
  USERS: 'users',
  DONATIONS: 'donations',
  BLOOD_REQUESTS: 'bloodRequests',
  BLOOD_INVENTORY: 'bloodInventory',
  CAMPAIGNS: 'campaigns',
  APPOINTMENTS: 'appointments',
  VOLUNTEERS: 'volunteers',
  PARTNERSHIPS: 'partnerships',
  NOTIFICATIONS: 'notifications',
  BADGES: 'badges',
  USER_BADGES: 'userBadges',
  VERIFICATION_REQUESTS: 'verificationRequests',
  ANALYTICS: 'analytics',
} as const;

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Converter for User documents
 * Handles timestamp fields: createdAt, lastLoginAt, dateOfBirth, lastDonation
 */
const userConverter = createConverter<User>([
  'createdAt',
  'lastLoginAt',
  'dateOfBirth',
  'lastDonation',
]);

/**
 * Converter for Donation documents
 * Handles timestamp fields: donationDate, createdAt, updatedAt
 */
const donationConverter = createConverter<Donation>([
  'donationDate',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for BloodRequest documents
 * Handles timestamp fields: requestedAt, neededBy, expiresAt, fulfilledAt, createdAt, updatedAt
 */
const bloodRequestConverter = createConverter<BloodRequest>([
  'requestedAt',
  'neededBy',
  'expiresAt',
  'fulfilledAt',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for BloodInventory documents
 * Handles timestamp fields: lastRestocked, updatedAt
 * Note: Batch timestamps are handled in nested objects
 */
const bloodInventoryConverter = createConverter<BloodInventory>([
  'lastRestocked',
  'updatedAt',
]);

/**
 * Converter for Campaign documents
 * Handles timestamp fields: startDate, endDate, createdAt, updatedAt
 */
const campaignConverter = createConverter<Campaign>([
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for Appointment documents
 * Handles timestamp fields: scheduledDate, reminderSentAt, completedAt, createdAt, updatedAt
 */
const appointmentConverter = createConverter<Appointment>([
  'scheduledDate',
  'reminderSentAt',
  'completedAt',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for Volunteer documents
 * Handles timestamp fields: joinedAt, lastActiveAt, createdAt, updatedAt
 */
const volunteerConverter = createConverter<Volunteer>([
  'joinedAt',
  'lastActiveAt',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for Partnership documents
 * Handles timestamp fields: startDate, endDate, createdAt, updatedAt
 */
const partnershipConverter = createConverter<Partnership>([
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
]);

/**
 * Converter for Notification documents
 * Handles timestamp fields: createdAt, readAt, expiresAt
 */
const notificationConverter = createConverter<Notification>([
  'createdAt',
  'readAt',
  'expiresAt',
]);

/**
 * Converter for Badge documents
 * Handles timestamp fields: createdAt
 */
const badgeConverter = createConverter<Badge>(['createdAt']);

/**
 * Converter for UserBadge documents
 * Handles timestamp fields: earnedAt
 */
const userBadgeConverter = createConverter<UserBadge>(['earnedAt']);

/**
 * Converter for VerificationRequest documents
 * Handles timestamp fields: submittedAt, updatedAt, reviewedAt
 */
const verificationRequestConverter = createConverter<VerificationRequest>([
  'submittedAt',
  'updatedAt',
  'reviewedAt',
]);

/**
 * Converter for Analytics documents
 * Handles timestamp fields: date, generatedAt
 */
const analyticsConverter = createConverter<Analytics>(['date', 'generatedAt']);

// ============================================================================
// TYPED COLLECTION REFERENCES
// ============================================================================

/**
 * Users collection reference
 */
export const usersCollection = collection(db, COLLECTIONS.USERS).withConverter(
  userConverter
) as CollectionReference<User>;

/**
 * Donations collection reference
 */
export const donationsCollection = collection(
  db,
  COLLECTIONS.DONATIONS
).withConverter(donationConverter) as CollectionReference<Donation>;

/**
 * Blood Requests collection reference
 */
export const bloodRequestsCollection = collection(
  db,
  COLLECTIONS.BLOOD_REQUESTS
).withConverter(bloodRequestConverter) as CollectionReference<BloodRequest>;

/**
 * Blood Inventory collection reference
 */
export const bloodInventoryCollection = collection(
  db,
  COLLECTIONS.BLOOD_INVENTORY
).withConverter(bloodInventoryConverter) as CollectionReference<BloodInventory>;

/**
 * Campaigns collection reference
 */
export const campaignsCollection = collection(
  db,
  COLLECTIONS.CAMPAIGNS
).withConverter(campaignConverter) as CollectionReference<Campaign>;

/**
 * Appointments collection reference
 */
export const appointmentsCollection = collection(
  db,
  COLLECTIONS.APPOINTMENTS
).withConverter(appointmentConverter) as CollectionReference<Appointment>;

/**
 * Volunteers collection reference
 */
export const volunteersCollection = collection(
  db,
  COLLECTIONS.VOLUNTEERS
).withConverter(volunteerConverter) as CollectionReference<Volunteer>;

/**
 * Partnerships collection reference
 */
export const partnershipsCollection = collection(
  db,
  COLLECTIONS.PARTNERSHIPS
).withConverter(partnershipConverter) as CollectionReference<Partnership>;

/**
 * Notifications collection reference
 */
export const notificationsCollection = collection(
  db,
  COLLECTIONS.NOTIFICATIONS
).withConverter(notificationConverter) as CollectionReference<Notification>;

/**
 * Badges collection reference
 */
export const badgesCollection = collection(db, COLLECTIONS.BADGES).withConverter(
  badgeConverter
) as CollectionReference<Badge>;

/**
 * User Badges collection reference
 */
export const userBadgesCollection = collection(
  db,
  COLLECTIONS.USER_BADGES
).withConverter(userBadgeConverter) as CollectionReference<UserBadge>;

/**
 * Verification Requests collection reference
 */
export const verificationRequestsCollection = collection(
  db,
  COLLECTIONS.VERIFICATION_REQUESTS
).withConverter(verificationRequestConverter) as CollectionReference<VerificationRequest>;

/**
 * Analytics collection reference
 */
export const analyticsCollection = collection(
  db,
  COLLECTIONS.ANALYTICS
).withConverter(analyticsConverter) as CollectionReference<Analytics>;

// ============================================================================
// DOCUMENT REFERENCE HELPERS
// ============================================================================

/**
 * Get a typed document reference for a user
 * @param userId - User document ID
 * @returns Typed DocumentReference for User
 */
export const getUserDocRef = (userId: string): DocumentReference<User> => {
  return doc(usersCollection, userId);
};

/**
 * Get a typed document reference for a donation
 * @param donationId - Donation document ID
 * @returns Typed DocumentReference for Donation
 */
export const getDonationDocRef = (donationId: string): DocumentReference<Donation> => {
  return doc(donationsCollection, donationId);
};

/**
 * Get a typed document reference for a blood request
 * @param requestId - Blood request document ID
 * @returns Typed DocumentReference for BloodRequest
 */
export const getBloodRequestDocRef = (requestId: string): DocumentReference<BloodRequest> => {
  return doc(bloodRequestsCollection, requestId);
};

/**
 * Get a typed document reference for blood inventory
 * @param inventoryId - Blood inventory document ID
 * @returns Typed DocumentReference for BloodInventory
 */
export const getBloodInventoryDocRef = (
  inventoryId: string
): DocumentReference<BloodInventory> => {
  return doc(bloodInventoryCollection, inventoryId);
};

/**
 * Get a typed document reference for a campaign
 * @param campaignId - Campaign document ID
 * @returns Typed DocumentReference for Campaign
 */
export const getCampaignDocRef = (campaignId: string): DocumentReference<Campaign> => {
  return doc(campaignsCollection, campaignId);
};

/**
 * Get a typed document reference for an appointment
 * @param appointmentId - Appointment document ID
 * @returns Typed DocumentReference for Appointment
 */
export const getAppointmentDocRef = (appointmentId: string): DocumentReference<Appointment> => {
  return doc(appointmentsCollection, appointmentId);
};

/**
 * Get a typed document reference for a volunteer
 * @param volunteerId - Volunteer document ID
 * @returns Typed DocumentReference for Volunteer
 */
export const getVolunteerDocRef = (volunteerId: string): DocumentReference<Volunteer> => {
  return doc(volunteersCollection, volunteerId);
};

/**
 * Get a typed document reference for a partnership
 * @param partnershipId - Partnership document ID
 * @returns Typed DocumentReference for Partnership
 */
export const getPartnershipDocRef = (partnershipId: string): DocumentReference<Partnership> => {
  return doc(partnershipsCollection, partnershipId);
};

/**
 * Get a typed document reference for a notification
 * @param notificationId - Notification document ID
 * @returns Typed DocumentReference for Notification
 */
export const getNotificationDocRef = (
  notificationId: string
): DocumentReference<Notification> => {
  return doc(notificationsCollection, notificationId);
};

/**
 * Get a typed document reference for a badge
 * @param badgeId - Badge document ID
 * @returns Typed DocumentReference for Badge
 */
export const getBadgeDocRef = (badgeId: string): DocumentReference<Badge> => {
  return doc(badgesCollection, badgeId);
};

/**
 * Get a typed document reference for a user badge
 * @param userBadgeId - User badge document ID
 * @returns Typed DocumentReference for UserBadge
 */
export const getUserBadgeDocRef = (userBadgeId: string): DocumentReference<UserBadge> => {
  return doc(userBadgesCollection, userBadgeId);
};

/**
 * Get a typed document reference for a verification request
 * @param requestId - Verification request document ID
 * @returns Typed DocumentReference for VerificationRequest
 */
export const getVerificationRequestDocRef = (
  requestId: string
): DocumentReference<VerificationRequest> => {
  return doc(verificationRequestsCollection, requestId);
};

/**
 * Get a typed document reference for analytics
 * @param analyticsId - Analytics document ID
 * @returns Typed DocumentReference for Analytics
 */
export const getAnalyticsDocRef = (analyticsId: string): DocumentReference<Analytics> => {
  return doc(analyticsCollection, analyticsId);
};

// ============================================================================
// EXPORT ALL COLLECTIONS AS AN OBJECT
// ============================================================================

/**
 * Object containing all typed collection references
 */
export const collections = {
  users: usersCollection,
  donations: donationsCollection,
  bloodRequests: bloodRequestsCollection,
  bloodInventory: bloodInventoryCollection,
  campaigns: campaignsCollection,
  appointments: appointmentsCollection,
  volunteers: volunteersCollection,
  partnerships: partnershipsCollection,
  notifications: notificationsCollection,
  badges: badgesCollection,
  userBadges: userBadgesCollection,
  verificationRequests: verificationRequestsCollection,
  analytics: analyticsCollection,
} as const;

/**
 * Object containing all document reference helper functions
 */
export const docRefs = {
  user: getUserDocRef,
  donation: getDonationDocRef,
  bloodRequest: getBloodRequestDocRef,
  bloodInventory: getBloodInventoryDocRef,
  campaign: getCampaignDocRef,
  appointment: getAppointmentDocRef,
  volunteer: getVolunteerDocRef,
  partnership: getPartnershipDocRef,
  notification: getNotificationDocRef,
  badge: getBadgeDocRef,
  userBadge: getUserBadgeDocRef,
  verificationRequest: getVerificationRequestDocRef,
  analytics: getAnalyticsDocRef,
} as const;

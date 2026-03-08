import {
  FIFTEEN_SECONDS_MS,
  FIVE_MINUTES_MS,
  ONE_MINUTE_MS,
  THIRTY_SECONDS_MS,
  TWELVE_HUNDRED_MS,
} from './time';

export const OFFLINE_MUTATION_TYPES = {
  userNotificationPreferences: 'user.notificationPreferences',
  userProfilePatch: 'user.profilePatch',
  adminNotificationRead: 'admin.notification.read',
  adminContactSubmissionStatus: 'admin.contactSubmission.status',
  adminNpsFollowUpStatus: 'admin.nps.followUpStatus',
  adminNpsFollowUpNotes: 'admin.nps.followUpNotes',
  adminNpsTags: 'admin.nps.tags',
  firestoreDocPatch: 'firestore.doc.patch',
  adminCampaignStatus: 'admin.campaign.status',
  adminAppointmentStatus: 'admin.appointment.status',
  adminDonationStatus: 'admin.donation.status',
  adminVolunteerStatus: 'admin.volunteer.status',
  adminPartnershipStatus: 'admin.partnership.status',
  adminEmergencyRequestStatus: 'admin.emergencyRequest.status',
} as const;

export type OfflineMutationType = typeof OFFLINE_MUTATION_TYPES[keyof typeof OFFLINE_MUTATION_TYPES];
export type OfflineMutationFeature =
  | 'user_profile'
  | 'notifications'
  | 'admin_comms'
  | 'admin_nps'
  | 'admin_campaigns'
  | 'admin_appointments'
  | 'admin_donations'
  | 'admin_volunteers'
  | 'admin_partnerships'
  | 'admin_emergency'
  | 'firestore_patch'
  | 'unknown';

export const OFFLINE_MUTATION_LABELS: Record<OfflineMutationType, string> = {
  [OFFLINE_MUTATION_TYPES.userNotificationPreferences]: 'Notification preferences update',
  [OFFLINE_MUTATION_TYPES.userProfilePatch]: 'User profile patch update',
  [OFFLINE_MUTATION_TYPES.adminNotificationRead]: 'Admin notification read status update',
  [OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus]: 'Admin contact submission status update',
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus]: 'Admin NPS follow-up status update',
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes]: 'Admin NPS follow-up notes update',
  [OFFLINE_MUTATION_TYPES.adminNpsTags]: 'Admin NPS tags update',
  [OFFLINE_MUTATION_TYPES.firestoreDocPatch]: 'Firestore document patch update',
  [OFFLINE_MUTATION_TYPES.adminCampaignStatus]: 'Admin campaign status update',
  [OFFLINE_MUTATION_TYPES.adminAppointmentStatus]: 'Admin appointment status update',
  [OFFLINE_MUTATION_TYPES.adminDonationStatus]: 'Admin donation status update',
  [OFFLINE_MUTATION_TYPES.adminVolunteerStatus]: 'Admin volunteer status update',
  [OFFLINE_MUTATION_TYPES.adminPartnershipStatus]: 'Admin partnership status update',
  [OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus]: 'Admin emergency request status update',
};

export const OFFLINE_MUTATION_FEATURES: Record<OfflineMutationType, OfflineMutationFeature> = {
  [OFFLINE_MUTATION_TYPES.userNotificationPreferences]: 'notifications',
  [OFFLINE_MUTATION_TYPES.userProfilePatch]: 'user_profile',
  [OFFLINE_MUTATION_TYPES.adminNotificationRead]: 'notifications',
  [OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus]: 'admin_comms',
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus]: 'admin_nps',
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes]: 'admin_nps',
  [OFFLINE_MUTATION_TYPES.adminNpsTags]: 'admin_nps',
  [OFFLINE_MUTATION_TYPES.firestoreDocPatch]: 'firestore_patch',
  [OFFLINE_MUTATION_TYPES.adminCampaignStatus]: 'admin_campaigns',
  [OFFLINE_MUTATION_TYPES.adminAppointmentStatus]: 'admin_appointments',
  [OFFLINE_MUTATION_TYPES.adminDonationStatus]: 'admin_donations',
  [OFFLINE_MUTATION_TYPES.adminVolunteerStatus]: 'admin_volunteers',
  [OFFLINE_MUTATION_TYPES.adminPartnershipStatus]: 'admin_partnerships',
  [OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus]: 'admin_emergency',
};

export const OFFLINE_FEATURE_OPERATOR_LABELS: Record<OfflineMutationFeature, string> = {
  user_profile: 'User profile updates',
  notifications: 'Notification updates',
  admin_comms: 'Contact submissions',
  admin_nps: 'NPS follow-up',
  admin_campaigns: 'Campaign status updates',
  admin_appointments: 'Appointment status updates',
  admin_donations: 'Donation status updates',
  admin_volunteers: 'Volunteer status updates',
  admin_partnerships: 'Partnership status updates',
  admin_emergency: 'Emergency request status updates',
  firestore_patch: 'Generic document updates',
  unknown: 'Unknown feature area',
};

export const OFFLINE_OUTBOX_CONFIG = {
  dbName: 'bloodhub_offline_mutations',
  storeName: 'mutations',
  dbVersion: 1,
  flushIntervalMs: FIFTEEN_SECONDS_MS,
  maxBackoffMs: FIVE_MINUTES_MS,
  minFlushTriggerGapMs: TWELVE_HUNDRED_MS,
  maxAttemptsPerMutation: 6,
  maxRecentEvents: 40,
  maxRecentEventsPerKind: 20,
  maxPendingItems: 25,
  maxDeadLetterItems: 100,
  maxHealthPersistWindowRuns: 1000,
  telemetryStorageKey: 'bh_offline_mutation_telemetry_v2',
  deadLetterStorageKey: 'bh_offline_mutation_dead_letter_v1',
} as const;

export const OFFLINE_HEALTH_THRESHOLDS = {
  staleSyncMs: FIVE_MINUTES_MS,
  warningSyncMs: ONE_MINUTE_MS,
  queueCountWarning: 10,
  queueCountCritical: 25,
  deadLetterWarning: 1,
  deadLetterCritical: 5,
  reconnectAutoSyncDelayMs: THIRTY_SECONDS_MS,
} as const;

export const OFFLINE_HEALTH_RECORDS_CONFIG = {
  persistIntervalMs: ONE_MINUTE_MS * 2,
  bucketMs: ONE_MINUTE_MS * 15,
  maxDeadLetterSamples: 5,
} as const;

export const OFFLINE_ANALYTICS_WINDOWS = {
  oneHour: ONE_MINUTE_MS * 60,
  sixHours: ONE_MINUTE_MS * 60 * 6,
  oneDay: ONE_MINUTE_MS * 60 * 24,
  sevenDays: ONE_MINUTE_MS * 60 * 24 * 7,
} as const;

export const OFFLINE_WRITE_CAPABILITY = {
  queueSafe: [
    'user.notificationPreferences',
    'user.profilePatch',
    'admin.notification.read',
    'admin.contactSubmission.status',
    'admin.nps.followUpStatus',
    'admin.nps.followUpNotes',
    'admin.nps.tags',
    'firestore.doc.patch',
    'admin.campaign.status',
    'admin.appointment.status',
    'admin.donation.status',
    'admin.volunteer.status',
    'admin.partnership.status',
    'admin.emergencyRequest.status',
  ],
  onlineOnly: [
    'fcm.token.save',
    'fcm.token.remove',
    'transactional.write',
  ],
  guardedByFirestorePersistence: [
    'profile.update',
    'cms.content.write',
    'admin.status.update',
  ],
} as const;

import { ONE_MINUTE_MS } from './time';

export const CONTACT_SUBMISSION_STATUS = {
  unread: 'unread',
  read: 'read',
} as const;

export type ContactSubmissionStatus = (typeof CONTACT_SUBMISSION_STATUS)[keyof typeof CONTACT_SUBMISSION_STATUS];

export const CONTACT_SUBMIT_ENDPOINT = '/.netlify/functions/contact-submit';

export const CONTACT_RATE_LIMIT_MAX_PER_MINUTE = 5;
export const CONTACT_RATE_LIMIT_WINDOW_MS = ONE_MINUTE_MS;

export const CONTACT_FIELD_LIMITS = {
  name: 120,
  email: 160,
  phone: 24,
  subject: 64,
  message: 2000,
} as const;

export const CONTACT_SUBJECT_OPTIONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'donor', label: 'Donor Support' },
  { value: 'bloodbank', label: 'BloodBank Partnership' },
  { value: 'emergency', label: 'Emergency Request' },
  { value: 'technical', label: 'Technical Support' },
] as const;

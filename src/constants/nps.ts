import { ONE_DAY_MS, SEVEN_DAYS_MS } from './time';

export const NPS_SCORE = {
  min: 0,
  max: 10,
  promoterMin: 9,
  passiveMin: 7,
} as const;

export const NPS_SEGMENT = {
  promoter: 'promoter',
  passive: 'passive',
  detractor: 'detractor',
} as const;

export type NpsSegment = (typeof NPS_SEGMENT)[keyof typeof NPS_SEGMENT];

export const NPS_FOLLOW_UP_STATUS = {
  open: 'open',
  inProgress: 'in_progress',
  closed: 'closed',
} as const;

export type NpsFollowUpStatus = (typeof NPS_FOLLOW_UP_STATUS)[keyof typeof NPS_FOLLOW_UP_STATUS];

export const NPS_ALLOWED_ROLES = ['donor', 'ngo', 'bloodbank'] as const;

export type NpsRole = (typeof NPS_ALLOWED_ROLES)[number];

export const NPS_QUESTION_VERSION = 'v1';
export const NPS_PROMPT_SOURCE = 'dashboard_prompt';
export const NPS_SETTINGS_SOURCE = 'settings_feedback';

export const NPS_COMMENT_MAX_LENGTH = 600;
export const NPS_FETCH_LIMIT = 3000;
export const NPS_DISMISS_SNOOZE_MS = 14 * ONE_DAY_MS;
export const NPS_RESPONSE_WINDOW_MS = 90 * ONE_DAY_MS;
export const NPS_DETRACTOR_SLA_MS = SEVEN_DAYS_MS;
export const NPS_DETRACTOR_ESCALATION_SLA_MS = 14 * ONE_DAY_MS;
export const NPS_MIN_SAMPLE_SIZE = 30;
export const NPS_MEDIUM_CONFIDENCE_SAMPLE_SIZE = 100;

export const NPS_DRIVER_TAGS = {
  support: 'support',
  availability: 'availability',
  appUx: 'app_ux',
  turnaround: 'turnaround',
  trust: 'trust',
  communication: 'communication',
  operations: 'operations',
} as const;

export type NpsDriverTag = (typeof NPS_DRIVER_TAGS)[keyof typeof NPS_DRIVER_TAGS];
export type NpsSampleConfidence = 'low' | 'medium' | 'high';

export const getNpsSegmentFromScore = (score: number): NpsSegment => {
  if (score >= NPS_SCORE.promoterMin) return NPS_SEGMENT.promoter;
  if (score >= NPS_SCORE.passiveMin) return NPS_SEGMENT.passive;
  return NPS_SEGMENT.detractor;
};

export const isValidNpsScore = (score: number): boolean => (
  Number.isInteger(score) && score >= NPS_SCORE.min && score <= NPS_SCORE.max
);

export const getNpsCycleKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
};

export const toNpsDocId = (uid: string, cycleKey: string): string => `${uid}_${cycleKey}`;

export const clampNpsComment = (comment: string): string => comment.trim().slice(0, NPS_COMMENT_MAX_LENGTH);

export const computeNpsScore = (promoters: number, detractors: number, total: number): number => {
  if (total <= 0) return 0;
  const promoterPct = (promoters / total) * 100;
  const detractorPct = (detractors / total) * 100;
  return Math.round((promoterPct - detractorPct) * 10) / 10;
};

export const isNpsSampleReliable = (sampleSize: number): boolean => sampleSize >= NPS_MIN_SAMPLE_SIZE;

export const getNpsSampleConfidence = (sampleSize: number): NpsSampleConfidence => {
  if (sampleSize < NPS_MIN_SAMPLE_SIZE) return 'low';
  if (sampleSize < NPS_MEDIUM_CONFIDENCE_SAMPLE_SIZE) return 'medium';
  return 'high';
};

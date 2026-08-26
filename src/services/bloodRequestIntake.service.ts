import { submitContactForm } from './contact.service';

/**
 * Public blood-request intake.
 *
 * The public form previously persisted nothing at all -- it fired an analytics
 * event, cleared itself and showed a success toast, so every request submitted
 * by a patient or family member was silently discarded.
 *
 * It cannot write `bloodRequests` directly: firestore.rules only lets verified
 * blood banks and admins create those documents, and opening that collection to
 * anonymous writes would be unsafe. Until a dedicated triage pipeline exists,
 * requests are routed through the existing `contact-submit` Cloud Function,
 * which already validates input, rate limits per IP+email, hashes the source IP
 * and user agent, and lands in Admin -> Contact Submissions where staff work.
 *
 * This is deliberately an interim bridge: it guarantees a human sees the
 * request. A purpose-built endpoint that creates a triaged `bloodRequests`
 * document with Admin SDK privileges is the eventual home.
 */
export type BloodRequestIntakePayload = {
  patientName: string;
  patientAge: string;
  bloodType: string;
  unitsNeeded: string;
  urgency: string;
  hospital: string;
  requiredDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  reason: string;
};

const SUBJECT_MAX = 64;

export const buildBloodRequestSubject = (payload: BloodRequestIntakePayload): string => {
  const urgency = (payload.urgency || 'normal').toUpperCase();
  return `Blood request: ${payload.bloodType} x${payload.unitsNeeded} (${urgency})`.slice(0, SUBJECT_MAX);
};

export const buildBloodRequestMessage = (payload: BloodRequestIntakePayload): string => [
  `Patient name:   ${payload.patientName}`,
  `Patient age:    ${payload.patientAge}`,
  `Blood type:     ${payload.bloodType}`,
  `Units needed:   ${payload.unitsNeeded}`,
  `Urgency:        ${payload.urgency}`,
  `Hospital:       ${payload.hospital}`,
  `Required by:    ${payload.requiredDate}`,
  `Reason:         ${payload.reason}`,
  '',
  `Contact name:   ${payload.contactName}`,
  `Contact phone:  ${payload.contactPhone}`,
  `Contact email:  ${payload.contactEmail}`,
].join('\n');

export const submitBloodRequest = async (payload: BloodRequestIntakePayload): Promise<void> => {
  await submitContactForm({
    name: payload.contactName,
    email: payload.contactEmail,
    phone: payload.contactPhone,
    subject: buildBloodRequestSubject(payload),
    message: buildBloodRequestMessage(payload),
  });
};

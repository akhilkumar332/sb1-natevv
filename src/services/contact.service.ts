import { CONTACT_FIELD_LIMITS, CONTACT_SUBMIT_ENDPOINT } from '../constants/contact';

export type ContactFormPayload = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const sanitizePayload = (payload: ContactFormPayload) => ({
  name: payload.name.trim().slice(0, CONTACT_FIELD_LIMITS.name),
  email: payload.email.trim().toLowerCase().slice(0, CONTACT_FIELD_LIMITS.email),
  phone: payload.phone.trim().slice(0, CONTACT_FIELD_LIMITS.phone),
  subject: payload.subject.trim().slice(0, CONTACT_FIELD_LIMITS.subject),
  message: payload.message.trim().slice(0, CONTACT_FIELD_LIMITS.message),
});

export const submitContactForm = async (payload: ContactFormPayload): Promise<void> => {
  const body = sanitizePayload(payload);

  const response = await fetch(CONTACT_SUBMIT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.ok) return;

  let errorMessage = 'Failed to submit contact form.';
  try {
    const parsed = await response.json();
    if (parsed?.error && typeof parsed.error === 'string') {
      errorMessage = parsed.error;
    }
  } catch {
    // no-op
  }

  const error = new Error(errorMessage);
  (error as any).statusCode = response.status;
  throw error;
};

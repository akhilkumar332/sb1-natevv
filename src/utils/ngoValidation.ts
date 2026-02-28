import { requireValue } from './validationFeedback';

type MaybeNgoUser = { uid?: string } | null | undefined;

export const requireNgoManagerSession = (
  user: MaybeNgoUser,
  scope: 'campaigns' | 'partnerships' | 'volunteers'
) => requireValue(Boolean(user?.uid), `You must be logged in to manage ${scope}.`);

export const requireCampaignRequiredFields = (form: {
  title?: string;
  startDate?: string;
  endDate?: string;
  city?: string;
  state?: string;
}) =>
  requireValue(
    Boolean(form.title && form.startDate && form.endDate && form.city && form.state),
    'Please fill out the required fields.'
  );

export const requirePartnershipRequiredFields = (form: {
  partnerName?: string;
  startDate?: string;
}) =>
  requireValue(
    Boolean(form.partnerName && form.startDate),
    'Please fill out the required fields.'
  );

export const requireVolunteerRequiredFields = (form: {
  name?: string;
  email?: string;
}) =>
  requireValue(
    Boolean(form.name && form.email),
    'Please enter volunteer name and email.'
  );

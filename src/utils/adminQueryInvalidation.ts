import type { QueryClient } from '@tanstack/react-query';
import { adminQueryKeys } from '../constants/adminQueryKeys';

const recipes = {
  emergencyStatusUpdated: [
    adminQueryKeys.emergencyRoot,
    adminQueryKeys.recentActivityRoot,
    adminQueryKeys.overviewRoot,
  ],
  verificationApproved: [
    adminQueryKeys.verificationRoot,
    adminQueryKeys.usersRoot,
    adminQueryKeys.overviewRoot,
    adminQueryKeys.platformStatsRoot,
  ],
  verificationRejected: [
    adminQueryKeys.verificationRoot,
    adminQueryKeys.overviewRoot,
    adminQueryKeys.platformStatsRoot,
  ],
  verificationUnderReview: [
    adminQueryKeys.verificationRoot,
    adminQueryKeys.overviewRoot,
  ],
  campaignStatusUpdated: [
    adminQueryKeys.campaignsRoot,
    adminQueryKeys.recentActivityRoot,
    adminQueryKeys.platformStatsRoot,
  ],
  appointmentStatusUpdated: [
    adminQueryKeys.appointmentsRoot,
    adminQueryKeys.recentActivityRoot,
  ],
  donationStatusUpdated: [
    adminQueryKeys.donationsRoot,
    adminQueryKeys.recentActivityRoot,
    adminQueryKeys.platformStatsRoot,
  ],
  userDetailActionUpdated: [
    adminQueryKeys.usersRoot,
    adminQueryKeys.userDetailRoot,
    adminQueryKeys.verificationRoot,
    adminQueryKeys.overviewRoot,
    adminQueryKeys.platformStatsRoot,
  ],
  notificationUpdated: [
    adminQueryKeys.notificationsRoot,
  ],
  contactSubmissionUpdated: [
    adminQueryKeys.contactSubmissionsRoot,
  ],
  volunteerUpdated: [
    adminQueryKeys.volunteersRoot,
  ],
  partnershipUpdated: [
    adminQueryKeys.partnershipsRoot,
  ],
} as const;

export type AdminInvalidationRecipe = keyof typeof recipes;

export const invalidateAdminRecipe = async (
  queryClient: QueryClient,
  recipe: AdminInvalidationRecipe
) => {
  const queryKeys = recipes[recipe];
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
};

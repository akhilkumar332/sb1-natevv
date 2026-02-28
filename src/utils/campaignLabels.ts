const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  'blood-drive': 'Blood Drive',
  awareness: 'Awareness',
  fundraising: 'Fundraising',
  volunteer: 'Volunteer Drive',
};

const CAMPAIGN_TARGET_LABELS: Record<string, string> = {
  units: 'Units',
  donors: 'Donors',
  funds: 'Funds',
  volunteers: 'Volunteers',
};

export const getCampaignTypeLabel = (type: string | undefined) =>
  (type ? CAMPAIGN_TYPE_LABELS[type] : undefined) || 'Campaign';

export const getCampaignTargetLabel = (targetType: string | undefined) =>
  (targetType ? CAMPAIGN_TARGET_LABELS[targetType] : undefined) || 'Units';

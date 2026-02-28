export const parseLocalDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const formatDateRange = (start: Date, end: Date) => {
  const startText = start.toLocaleDateString();
  const endText = end.toLocaleDateString();
  return `${startText} • ${endText}`;
};

export const toInputDate = (date: Date) => date.toISOString().split('T')[0];

export const validateCampaignDateRangeInput = (startInput: string, endInput: string): string | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = parseLocalDate(startInput);
  const endDate = parseLocalDate(endInput);

  if (!startDate || !endDate) {
    return 'Please enter valid dates.';
  }
  if (startDate < today) {
    return 'Start date cannot be in the past.';
  }
  if (endDate < today) {
    return 'End date cannot be in the past.';
  }
  if (endDate <= startDate) {
    return 'End date must be after start date.';
  }
  return null;
};

export const resolveCampaignDateRangeInput = (startInput: string, endInput: string) => {
  const error = validateCampaignDateRangeInput(startInput, endInput);
  if (error) {
    return { error, startDate: null, endDate: null } as const;
  }

  const startDate = parseLocalDate(startInput);
  const endDate = parseLocalDate(endInput);
  if (!startDate || !endDate) {
    return { error: 'Please enter valid dates.', startDate: null, endDate: null } as const;
  }

  return { error: null, startDate, endDate } as const;
};

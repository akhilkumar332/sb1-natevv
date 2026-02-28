export const toDateValue = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate();
    }
    if (typeof candidate.seconds === 'number') {
      return new Date(candidate.seconds * 1000);
    }
  }

  return undefined;
};


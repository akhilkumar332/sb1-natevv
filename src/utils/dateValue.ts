export const toDateValue = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const next = new Date(value);
    return Number.isNaN(next.getTime()) ? undefined : next;
  }
  if (typeof value === 'string') {
    const next = new Date(value);
    return Number.isNaN(next.getTime()) ? undefined : next;
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number; milliseconds?: number };
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate();
    }
    if (typeof candidate.seconds === 'number') {
      return new Date(candidate.seconds * 1000);
    }
    if (typeof candidate.milliseconds === 'number') {
      return new Date(candidate.milliseconds);
    }
  }

  return undefined;
};

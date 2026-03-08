export const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());

export const isMediaUrlOrPath = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return true;
  return normalized.startsWith('/') || isAbsoluteHttpUrl(normalized);
};

export const validateScheduleWindow = (
  scheduledPublishAt: string,
  scheduledUnpublishAt: string,
): { publishAt: Date | null; unpublishAt: Date | null; error: string | null } => {
  const publishAt = scheduledPublishAt ? new Date(scheduledPublishAt) : null;
  const unpublishAt = scheduledUnpublishAt ? new Date(scheduledUnpublishAt) : null;

  if (publishAt && Number.isNaN(publishAt.getTime())) {
    return { publishAt: null, unpublishAt: null, error: 'Scheduled publish date/time is invalid.' };
  }
  if (unpublishAt && Number.isNaN(unpublishAt.getTime())) {
    return { publishAt: null, unpublishAt: null, error: 'Scheduled unpublish date/time is invalid.' };
  }
  if (publishAt && unpublishAt && unpublishAt.getTime() <= publishAt.getTime()) {
    return { publishAt, unpublishAt, error: 'Scheduled unpublish must be after scheduled publish.' };
  }
  return { publishAt, unpublishAt, error: null };
};

export const parseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

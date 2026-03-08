import { CMS_STATUS, type CmsStatus } from './cms';

export const CMS_STATUS_LABELS: Record<CmsStatus, string> = {
  [CMS_STATUS.draft]: 'In Progress',
  [CMS_STATUS.scheduled]: 'Scheduled',
  [CMS_STATUS.published]: 'Live',
  [CMS_STATUS.archived]: 'Hidden',
};

export const CMS_STATUS_HELP: Record<CmsStatus, string> = {
  [CMS_STATUS.draft]: 'Content is editable and not public.',
  [CMS_STATUS.scheduled]: 'Content will be published automatically at the scheduled time.',
  [CMS_STATUS.published]: 'Content is publicly visible.',
  [CMS_STATUS.archived]: 'Content is hidden from public view.',
};

export const toHumanCmsStatus = (status: string | null | undefined): string => {
  if (!status) return 'In Progress';
  if (status in CMS_STATUS_LABELS) {
    return CMS_STATUS_LABELS[status as CmsStatus];
  }
  return status
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

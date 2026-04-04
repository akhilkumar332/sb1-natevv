import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishedCmsPageBySlug } from './useCmsContent';
import { getCmsFrontendPageDefaultContent, type CmsFrontendPageContentMap } from '../constants/cmsPageDefaults';
import type { CmsFrontendPageSlug } from '../constants/cms';
import { resolveCmsFrontendContent } from '../utils/cmsFrontendContent';
import { pickLocalizedCmsString } from '../utils/cmsLocalization';

const CMS_PREVIEW_EVENT = 'cms:preview:update';
const CMS_PREVIEW_CLEAR_EVENT = 'cms:preview:clear';

export const useCmsFrontendPageContent = <T extends CmsFrontendPageSlug>(slug: T) => {
  const { i18n } = useTranslation();
  const pageQuery = usePublishedCmsPageBySlug(slug);
  const [previewOverride, setPreviewOverride] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return undefined;

    const onPreviewUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string; content?: unknown }>).detail;
      if (!detail || detail.slug !== slug) return;
      if (detail.content && typeof detail.content === 'object' && !Array.isArray(detail.content)) {
        setPreviewOverride(detail.content as Record<string, unknown>);
      }
    };

    const onPreviewClear = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (!detail || detail.slug !== slug) return;
      setPreviewOverride(null);
    };

    window.addEventListener(CMS_PREVIEW_EVENT, onPreviewUpdate as EventListener);
    window.addEventListener(CMS_PREVIEW_CLEAR_EVENT, onPreviewClear as EventListener);
    return () => {
      window.removeEventListener(CMS_PREVIEW_EVENT, onPreviewUpdate as EventListener);
      window.removeEventListener(CMS_PREVIEW_CLEAR_EVENT, onPreviewClear as EventListener);
    };
  }, [slug]);

  useEffect(() => {
    setPreviewOverride(null);
  }, [slug]);

  const content = useMemo(() => {
    const localizedContentJson = pickLocalizedCmsString(
      i18n.resolvedLanguage,
      pageQuery.data?.contentJsonByLocale,
      pageQuery.data?.contentJson || null,
    );
    const baseResolved = resolveCmsFrontendContent(
      localizedContentJson,
      getCmsFrontendPageDefaultContent(slug)
    );
    if (!previewOverride) return baseResolved;
    return resolveCmsFrontendContent(JSON.stringify(previewOverride), baseResolved);
  }, [i18n.resolvedLanguage, pageQuery.data?.contentJson, pageQuery.data?.contentJsonByLocale, previewOverride, slug]);

  return {
    ...pageQuery,
    content: content as CmsFrontendPageContentMap[T],
  };
};

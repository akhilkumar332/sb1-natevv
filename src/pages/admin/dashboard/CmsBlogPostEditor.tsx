import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import {
  CMS_FEATURE_FLAGS,
  CMS_FRONTEND_PAGE_PRESETS,
  CMS_DEFAULTS,
  CMS_EDITOR,
  CMS_LIMITS,
  CMS_REVIEW_STATUS,
  CMS_SEO_GUIDELINES,
  CMS_STATUS,
  getCmsPostDocId,
  toCmsSlug,
} from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsBlogCategories, useAdminCmsBlogPosts, useAdminCmsPages, useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { runSeoAudit } from '../../../utils/seoAudit';
import { toDateValue } from '../../../utils/dateValue';
import SeoSnippetPreview from '../../../components/cms/SeoSnippetPreview';
import CmsRichTextEditor from '../../../components/cms/CmsRichTextEditor';
import { toCmsBlogSummaryPayload } from '../../../utils/cmsBlogSummary';
import { isAbsoluteHttpUrl, isMediaUrlOrPath, validateScheduleWindow } from '../../../utils/cmsValidation';
import { recordCmsOperationFailure } from '../../../services/cmsDiagnostics.service';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';
import { appendInternalLinkToCmsRichContent, extractCmsPlainText, parseCmsRichContent, serializeCmsRichContent } from '../../../utils/cmsRichContent';

const statusOptions = Object.values(CMS_STATUS);
const toDateTimeLocalValue = (value: unknown): string => {
  const date = toDateValue(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

type EditorTab = 'content' | 'media' | 'seo' | 'settings';
type RevisionEntry = {
  savedAt: string;
  title: string;
  status: string;
  excerpt: string;
  contentJson: string;
};
type ServerRevisionEntry = RevisionEntry & {
  id: string;
  savedBy: string;
  version: number;
};

const toModernBlogContentJson = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw.trim()) return '';
  return serializeCmsRichContent(parseCmsRichContent(raw).html);
};

const REVISION_LIMIT = 10;
const revisionStorageKey = (slug: string) => `cms_blog_revisions_${slug}`;
const draftStorageKey = (scope: string) => `cms_blog_draft_${scope}`;

export default function CmsBlogPostEditorPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams<{ slug: string }>();
  const postsQuery = useAdminCmsBlogPosts();
  const categoriesQuery = useAdminCmsBlogCategories();
  const pagesQuery = useAdminCmsPages();
  const settingsQuery = useAdminCmsSettings();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.draft);
  const [excerpt, setExcerpt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState('');
  const [seoNoIndex, setSeoNoIndex] = useState(false);
  const [seoNoFollow, setSeoNoFollow] = useState(false);
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [twitterImageUrl, setTwitterImageUrl] = useState('');
  const [workflowAssignee, setWorkflowAssignee] = useState('');
  const [reviewStatus, setReviewStatus] = useState<(typeof CMS_REVIEW_STATUS)[keyof typeof CMS_REVIEW_STATUS]>(CMS_REVIEW_STATUS.notRequested);
  const [reviewNotes, setReviewNotes] = useState('');
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [scheduledUnpublishAt, setScheduledUnpublishAt] = useState('');
  const [revisionHistory, setRevisionHistory] = useState<RevisionEntry[]>([]);
  const [serverRevisionHistory, setServerRevisionHistory] = useState<ServerRevisionEntry[]>([]);
  const [seriesSlug, setSeriesSlug] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [relatedPostSlugsInput, setRelatedPostSlugsInput] = useState('');
  const [featuredUntil, setFeaturedUntil] = useState('');
  const [restoreDraftPayload, setRestoreDraftPayload] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [showAdvancedSeo, setShowAdvancedSeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [autosaveSecondsAgo, setAutosaveSecondsAgo] = useState<number | null>(null);
  const hasHydratedDraftRef = useRef(false);
  const loadedUpdatedAtRef = useRef<number | null>(null);

  const rows = useMemo(() => postsQuery.data || [], [postsQuery.data]);
  const categoryOptions = useMemo(() => (categoriesQuery.data || []).filter((entry) => entry.status !== 'archived'), [categoriesQuery.data]);
  const normalizedParamSlug = toCmsSlug(slugParam || '');
  const isNewPost = normalizedParamSlug === 'new' || !normalizedParamSlug;
  const existingForSlug = useMemo(
    () => rows.find((entry) => entry.slug === normalizedParamSlug),
    [rows, normalizedParamSlug]
  );
  const existingRevisionKey = useMemo(() => {
    if (!existingForSlug) return 'none';
    const updatedAt = toDateValue(existingForSlug.updatedAt);
    return `${existingForSlug.id}:${updatedAt?.getTime() ?? 'no-updated-at'}`;
  }, [existingForSlug]);

  const titleLen = title.trim().length;
  const excerptLen = excerpt.trim().length;
  const seoTitleLen = (seoTitle.trim() || title.trim()).length;
  const seoDescLen = (seoDescription.trim() || excerpt.trim()).length;
  const parsedArticleContent = useMemo(() => parseCmsRichContent(contentJson), [contentJson]);
  const articlePlainText = useMemo(() => extractCmsPlainText(contentJson), [contentJson]);

  const publishChecks = useMemo(() => {
    const critical = [
      { id: 'title', label: t('cms.postTitle'), passed: Boolean(title.trim()) },
      { id: 'slug', label: t('cms.postSlug'), passed: Boolean(toCmsSlug(slug || title)) },
      { id: 'content', label: t('cms.articleContent'), passed: Boolean(articlePlainText.trim()) },
    ];
    const warnings = [
      { id: 'excerpt', label: t('cms.summary'), passed: Boolean(excerpt.trim()) },
      { id: 'image', label: t('cms.coverImageUrl'), passed: Boolean(coverImageUrl.trim()) },
      {
        id: 'seo-title',
        label: t('cms.recommendedCharacters', {
          min: CMS_SEO_GUIDELINES.titleMin,
          max: CMS_SEO_GUIDELINES.titleMax,
        }),
        passed: seoTitleLen >= CMS_SEO_GUIDELINES.titleMin && seoTitleLen <= CMS_SEO_GUIDELINES.titleMax,
      },
      {
        id: 'seo-desc',
        label: t('cms.recommendedCharacters', {
          min: CMS_SEO_GUIDELINES.descriptionMin,
          max: CMS_SEO_GUIDELINES.descriptionMax,
        }),
        passed: seoDescLen >= CMS_SEO_GUIDELINES.descriptionMin && seoDescLen <= CMS_SEO_GUIDELINES.descriptionMax,
      },
    ];
    return { critical, warnings };
  }, [title, slug, articlePlainText, excerpt, coverImageUrl, seoTitleLen, seoDescLen, t]);

  useEffect(() => {
    setIsDirty(false);
    setInitializedFor(null);
    hasHydratedDraftRef.current = false;
    setRestoreDraftPayload(null);
  }, [slugParam]);

  useEffect(() => {
    if (!slugParam) return;
    const hydrationKey = isNewPost ? `new:${slugParam}` : `${slugParam}:${existingRevisionKey}`;
    if (initializedFor === hydrationKey) return;
    if (isDirty) return;
    if (!isNewPost && (postsQuery.isLoading || postsQuery.isFetching)) return;

    if (isNewPost) {
      setTitle('');
      setSlug('');
      setStatus(CMS_STATUS.draft);
      setExcerpt('');
      setSeoTitle('');
      setSeoDescription('');
      setContentJson('');
      setTagsInput('');
      setCategorySlug('');
      setCoverImageUrl('');
      setFeatured(false);
      setSeoCanonicalUrl('');
      setSeoNoIndex(false);
      setSeoNoFollow(false);
      setOgTitle('');
      setOgDescription('');
      setOgImageUrl('');
      setTwitterImageUrl('');
      setWorkflowAssignee('');
      setReviewStatus(CMS_REVIEW_STATUS.notRequested);
      setReviewNotes('');
      setScheduledPublishAt('');
      setScheduledUnpublishAt('');
      setSeriesSlug('');
      setAuthorName('');
      setRelatedPostSlugsInput('');
      setFeaturedUntil('');
      setRevisionHistory([]);
      loadedUpdatedAtRef.current = null;
      setInitializedFor(hydrationKey);
      return;
    }

    const existing = existingForSlug;
    if (existing) {
      setTitle(existing.title || normalizedParamSlug);
      setSlug(existing.slug || normalizedParamSlug);
      setStatus(existing.status || CMS_STATUS.draft);
      setExcerpt(existing.excerpt || '');
      setSeoTitle(existing.seoTitle || '');
      setSeoDescription(existing.seoDescription || '');
      setContentJson(toModernBlogContentJson(existing.contentJson || ''));
      setTagsInput(Array.isArray(existing.tags) ? existing.tags.join(', ') : '');
      setCategorySlug(existing.categorySlug || '');
      setCoverImageUrl(existing.coverImageUrl || '');
      setFeatured(existing.featured === true);
      setSeoCanonicalUrl(existing.seoCanonicalUrl || '');
      setSeoNoIndex(existing.seoNoIndex === true);
      setSeoNoFollow(existing.seoNoFollow === true);
      setOgTitle(existing.ogTitle || '');
      setOgDescription(existing.ogDescription || '');
      setOgImageUrl(existing.ogImageUrl || '');
      setTwitterImageUrl(existing.twitterImageUrl || '');
      setWorkflowAssignee(existing.workflowAssignee || '');
      setReviewStatus(existing.reviewStatus || CMS_REVIEW_STATUS.notRequested);
      setReviewNotes(existing.reviewNotes || '');
      setScheduledPublishAt(toDateTimeLocalValue(existing.scheduledPublishAt));
      setScheduledUnpublishAt(toDateTimeLocalValue(existing.scheduledUnpublishAt));
      setSeriesSlug(existing.seriesSlug || '');
      setAuthorName(existing.authorName || '');
      setRelatedPostSlugsInput(Array.isArray(existing.relatedPostSlugs) ? existing.relatedPostSlugs.join(', ') : '');
      setFeaturedUntil(toDateTimeLocalValue(existing.featuredUntil));
      loadedUpdatedAtRef.current = toDateValue(existing.updatedAt)?.getTime() ?? null;
    }
    setInitializedFor(hydrationKey);
  }, [initializedFor, isDirty, isNewPost, normalizedParamSlug, postsQuery.isLoading, postsQuery.isFetching, slugParam, existingForSlug, existingRevisionKey]);

  const seoAudit = runSeoAudit({
    title,
    seoTitle,
    slug,
    excerpt,
    seoDescription,
    contentJson,
    coverImageUrl,
    ogImageUrl,
  });
  const previewTitle = (seoTitle.trim() || title.trim() || 'Untitled post').slice(0, CMS_LIMITS.seoTitle);
  const previewDescription = (
    seoDescription.trim()
    || excerpt.trim()
    || 'Add a short summary so people understand this post in search results.'
  ).slice(0, CMS_LIMITS.seoDescription);
  const previewSlug = toCmsSlug(slug || title) || 'untitled-post';
  const draftScopeKey = isNewPost ? `new_${toCmsSlug(slugParam || 'new') || 'new'}` : (normalizedParamSlug || previewSlug);
  const previewBaseUrl = (settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl).replace(/\/+$/, '');
  const previewUrl = `${previewBaseUrl}/blog/${previewSlug}`;
  const normalizedTags = useMemo(
    () => tagsInput
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, CMS_LIMITS.tagsPerPost),
    [tagsInput]
  );
  const relatedPostSlugs = useMemo(
    () => relatedPostSlugsInput
      .split(',')
      .map((item) => toCmsSlug(item))
      .filter(Boolean)
      .slice(0, CMS_LIMITS.relatedPostsPerEntry),
    [relatedPostSlugsInput]
  );
  const readability = useMemo(() => {
    const text = `${excerpt}\n${articlePlainText}`.replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').filter(Boolean).length : 0;
    const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
    const syllables = (text.toLowerCase().match(/[aeiouy]{1,2}/g) || []).length;
    const readingMinutes = Math.max(1, Math.ceil(words / 220));
    const flesch = words > 0
      ? (206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / Math.max(1, words))))
      : 0;
    const rounded = Number.isFinite(flesch) ? Math.round(flesch) : 0;
    const level = rounded >= 60 ? 'Easy' : rounded >= 30 ? 'Moderate' : 'Hard';
    return { words, sentences, readingMinutes, score: rounded, level };
  }, [excerpt, articlePlainText]);
  const currentPlainLength = articlePlainText.trim().length;
  const canonicalConflictCount = useMemo(() => {
    const canonical = seoCanonicalUrl.trim().toLowerCase();
    if (!canonical) return 0;
    const ownId = existingForSlug?.id || '';
    const inPosts = rows.filter((entry) => entry.id !== ownId && (entry.seoCanonicalUrl || '').trim().toLowerCase() === canonical).length;
    const inPages = (pagesQuery.data || []).filter((entry) => (entry.seoCanonicalUrl || '').trim().toLowerCase() === canonical).length;
    return inPosts + inPages;
  }, [seoCanonicalUrl, existingForSlug?.id, rows, pagesQuery.data]);
  const publishBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!title.trim()) blockers.push('Title is required.');
    if (!toCmsSlug(slug || title)) blockers.push('Slug is required and must be valid.');
    if (!articlePlainText.trim()) blockers.push('Article content is required.');
    if (!excerpt.trim()) blockers.push('Summary is required before publish.');
    if (seoTitleLen < CMS_SEO_GUIDELINES.titleMin || seoTitleLen > CMS_SEO_GUIDELINES.titleMax) {
      blockers.push(`Search title should be ${CMS_SEO_GUIDELINES.titleMin}-${CMS_SEO_GUIDELINES.titleMax} characters.`);
    }
    if (seoDescLen < CMS_SEO_GUIDELINES.descriptionMin || seoDescLen > CMS_SEO_GUIDELINES.descriptionMax) {
      blockers.push(`Search description should be ${CMS_SEO_GUIDELINES.descriptionMin}-${CMS_SEO_GUIDELINES.descriptionMax} characters.`);
    }
    if (settingsQuery.data?.requireApprovalBeforePublish && reviewStatus !== CMS_REVIEW_STATUS.approved) {
      blockers.push('Review status must be approved to publish.');
    }
    if (canonicalConflictCount > 0) blockers.push('Canonical URL conflicts with another CMS entry.');
    return blockers;
  }, [
    title,
    slug,
    articlePlainText,
    excerpt,
    seoTitleLen,
    seoDescLen,
    settingsQuery.data?.requireApprovalBeforePublish,
    reviewStatus,
    canonicalConflictCount,
  ]);
  const blockerTabMap = useMemo(() => {
    const map = new Map<string, EditorTab>();
    publishBlockers.forEach((blocker) => {
      const text = blocker.toLowerCase();
      if (text.includes('title') || text.includes('slug') || text.includes('content') || text.includes('summary')) map.set(blocker, 'content');
      else if (text.includes('search') || text.includes('canonical') || text.includes('seo')) map.set(blocker, 'seo');
      else map.set(blocker, 'settings');
    });
    return map;
  }, [publishBlockers]);
  const guideState = useMemo(() => ({
    contentReady: Boolean(title.trim() && toCmsSlug(slug || title) && articlePlainText.trim() && excerpt.trim()),
    mediaReady: Boolean(coverImageUrl.trim()),
    seoReady: seoTitleLen >= CMS_SEO_GUIDELINES.titleMin
      && seoTitleLen <= CMS_SEO_GUIDELINES.titleMax
      && seoDescLen >= CMS_SEO_GUIDELINES.descriptionMin
      && seoDescLen <= CMS_SEO_GUIDELINES.descriptionMax
      && canonicalConflictCount === 0,
    reviewReady: !settingsQuery.data?.requireApprovalBeforePublish || reviewStatus === CMS_REVIEW_STATUS.approved,
  }), [
    title,
    slug,
    articlePlainText,
    excerpt,
    coverImageUrl,
    seoTitleLen,
    seoDescLen,
    canonicalConflictCount,
    settingsQuery.data?.requireApprovalBeforePublish,
    reviewStatus,
  ]);
  const linkSuggestions = useMemo(() => {
    const words = title.toLowerCase().split(/\s+/).filter((word) => word.length >= 4);
    if (!words.length) return [];
    const presetPathBySlug = new Map<string, string>(CMS_FRONTEND_PAGE_PRESETS.map((preset) => [preset.slug, preset.path]));
    const all = [
      ...rows.map((entry) => ({ label: entry.title, path: ROUTES.blogPost.replace(':slug', entry.slug), source: 'blog' as const })),
      ...(pagesQuery.data || [])
        .filter((entry) => Boolean(entry.slug))
        .map((entry) => ({
          label: entry.title,
          path: presetPathBySlug.get(entry.slug) || (entry.slug === 'home' ? ROUTES.home : `/${entry.slug}`),
          source: 'page' as const,
        })),
    ];
    return all
      .filter((entry) => words.some((word) => entry.label.toLowerCase().includes(word)))
      .slice(0, 6);
  }, [title, rows, pagesQuery.data]);

  useEffect(() => {
    const key = revisionStorageKey(previewSlug);
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      const parsed = raw ? JSON.parse(raw) as RevisionEntry[] : [];
      setRevisionHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRevisionHistory([]);
    }
  }, [previewSlug]);

  useEffect(() => {
    if (isNewPost || !normalizedParamSlug) {
      setServerRevisionHistory([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await getDocs(query(
          collection(db, COLLECTIONS.CMS_BLOG_POST_REVISIONS),
          where('postSlug', '==', normalizedParamSlug),
          orderBy('savedAt', 'desc'),
          limit(10),
        ));
        if (cancelled) return;
        const rows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            savedAt: toDateValue(data.savedAt)?.toISOString() || new Date().toISOString(),
            title: typeof data.title === 'string' ? data.title : '',
            status: typeof data.status === 'string' ? data.status : CMS_STATUS.draft,
            excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
            contentJson: typeof data.contentJson === 'string' ? data.contentJson : '',
            savedBy: typeof data.savedBy === 'string' ? data.savedBy : 'unknown',
            version: Number.isFinite(data.version) ? Number(data.version) : 1,
          } as ServerRevisionEntry;
        });
        setServerRevisionHistory(rows);
      } catch {
        if (!cancelled) setServerRevisionHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNewPost, normalizedParamSlug]);

  useEffect(() => {
    if (hasHydratedDraftRef.current) return;
    hasHydratedDraftRef.current = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftStorageKey(draftScopeKey));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt?: number; values?: Record<string, unknown> };
      if (!parsed?.savedAt || !parsed.values) return;
      if (Date.now() - parsed.savedAt > CMS_EDITOR.draftTtlMs) {
        window.localStorage.removeItem(draftStorageKey(draftScopeKey));
        return;
      }
      setRestoreDraftPayload(parsed.values);
    } catch {
      // no-op
    }
  }, [draftScopeKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isDirty) return;
    const timer = window.setTimeout(() => {
      const values = {
        title,
        slug,
        status,
        excerpt,
        seoTitle,
        seoDescription,
        contentJson,
        tagsInput,
        categorySlug,
        coverImageUrl,
        featured,
        seoCanonicalUrl,
        seoNoIndex,
        seoNoFollow,
        ogTitle,
        ogDescription,
        ogImageUrl,
        twitterImageUrl,
        workflowAssignee,
        reviewStatus,
        reviewNotes,
        scheduledPublishAt,
        scheduledUnpublishAt,
        seriesSlug,
        authorName,
        relatedPostSlugsInput,
        featuredUntil,
      };
      try {
        window.localStorage.setItem(draftStorageKey(draftScopeKey), JSON.stringify({ savedAt: Date.now(), values }));
        setLastSavedAt(Date.now());
      } catch {
        // no-op
      }
    }, CMS_EDITOR.autosaveDebounceMs);
    return () => window.clearTimeout(timer);
  }, [
    isDirty,
    draftScopeKey,
    title,
    slug,
    status,
    excerpt,
    seoTitle,
    seoDescription,
    contentJson,
    tagsInput,
    categorySlug,
    coverImageUrl,
    featured,
    seoCanonicalUrl,
    seoNoIndex,
    seoNoFollow,
    ogTitle,
    ogDescription,
    ogImageUrl,
    twitterImageUrl,
    workflowAssignee,
    reviewStatus,
    reviewNotes,
    scheduledPublishAt,
    scheduledUnpublishAt,
    seriesSlug,
    authorName,
    relatedPostSlugsInput,
    featuredUntil,
  ]);
  useEffect(() => {
    if (!lastSavedAt || typeof window === 'undefined') {
      setAutosaveSecondsAgo(null);
      return;
    }
    const tick = () => setAutosaveSecondsAgo(Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  const savePost = async (targetStatus?: (typeof statusOptions)[number]) => {
    const normalizedTitle = title.trim();
    const normalizedSlug = toCmsSlug(slug || title);
    const nextStatus = targetStatus || status;

    if (!normalizedTitle || !normalizedSlug) {
      notify.error(t('cms.postTitleRequired'));
      return;
    }

    if (nextStatus === CMS_STATUS.published && publishBlockers.length > 0) {
      notify.error(publishBlockers[0] || t('cms.completeRequiredPublishChecklist'));
      return;
    }
    if (nextStatus === CMS_STATUS.published && (settingsQuery.isLoading || settingsQuery.isFetching)) {
      notify.error(t('cms.waitForSettingsBeforePublishing'));
      return;
    }
    if (
      nextStatus === CMS_STATUS.published
      && settingsQuery.data?.requireApprovalBeforePublish
      && reviewStatus !== CMS_REVIEW_STATUS.approved
    ) {
      notify.error(t('cms.reviewApprovalRequired'));
      return;
    }

    const duplicate = rows.find((entry) => (
      entry.slug === normalizedSlug
      && entry.slug !== normalizedParamSlug
    ));
    if (duplicate) {
      notify.error(t('cms.duplicateSlugError'));
      return;
    }

    const normalizedContentJson = contentJson.trim()
      ? serializeCmsRichContent(parsedArticleContent.html)
      : '';

    if (normalizedContentJson.length > CMS_LIMITS.contentJson) {
      notify.error(t('cms.contentTooLong', { count: CMS_LIMITS.contentJson }));
      return;
    }
    if (seoCanonicalUrl.trim() && !isAbsoluteHttpUrl(seoCanonicalUrl)) {
      notify.error(t('cms.canonicalUrlInvalid'));
      return;
    }
    if (!isMediaUrlOrPath(coverImageUrl) || !isMediaUrlOrPath(ogImageUrl) || !isMediaUrlOrPath(twitterImageUrl)) {
      notify.error(t('cms.imageUrlInvalid'));
      return;
    }
    const scheduleValidation = validateScheduleWindow(scheduledPublishAt, scheduledUnpublishAt);
    const parsedScheduledPublishAt = scheduleValidation.publishAt;
    const parsedScheduledUnpublishAt = scheduleValidation.unpublishAt;
    const parsedFeaturedUntil = featuredUntil ? new Date(featuredUntil) : null;
    if (scheduleValidation.error) {
      notify.error(scheduleValidation.error);
      return;
    }
    if (parsedFeaturedUntil && Number.isNaN(parsedFeaturedUntil.getTime())) {
      notify.error(t('cms.featuredUntilInvalid'));
      return;
    }
    if (relatedPostSlugs.includes(normalizedSlug)) {
      notify.error(t('cms.relatedPostsCannotIncludeSelf'));
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      const currentEntry = rows.find((entry) => entry.slug === normalizedParamSlug);
      const targetRef = doc(
        db,
        COLLECTIONS.CMS_BLOG_POSTS,
        currentEntry?.id || getCmsPostDocId(normalizedSlug)
      );
      const existing = await getDoc(targetRef);
      const existingData = existing.exists() ? existing.data() : null;
      const latestUpdatedAtMs = toDateValue(existingData?.updatedAt)?.getTime() ?? null;
      if (
        !isNewPost
        && loadedUpdatedAtRef.current
        && latestUpdatedAtMs
        && latestUpdatedAtMs > loadedUpdatedAtRef.current
      ) {
        const shouldOverwrite = typeof window !== 'undefined'
          ? window.confirm(t('cms.newerVersionConfirm'))
          : false;
        if (!shouldOverwrite) {
          notify.error(t('cms.saveCancelledNewerVersion'));
          setSaving(false);
          return;
        }
      }
      const createdAt = existingData?.createdAt || now;
      const createdBy = existingData?.createdBy || user?.uid || 'admin';
      const publishedAt = nextStatus === CMS_STATUS.published
        ? (existingData?.publishedAt || now)
        : null;
      const existingVersion = Number.isFinite(existingData?.version) ? Number(existingData?.version) : 0;
      const nextVersion = existingVersion + 1;
      const existingAliases = Array.isArray(existingData?.slugAliases)
        ? existingData.slugAliases.filter((item: unknown) => typeof item === 'string')
        : [];
      const previousSlug = typeof existingData?.slug === 'string' ? existingData.slug : '';
      const slugAliases = Array.from(new Set([
        ...existingAliases,
        ...(previousSlug && previousSlug !== normalizedSlug ? [previousSlug] : []),
      ])).slice(0, CMS_LIMITS.slugAliasesPerEntry);

      const resolvedSeoTitle = seoTitle.trim().slice(0, CMS_LIMITS.seoTitle) || normalizedTitle.slice(0, CMS_LIMITS.seoTitle);
      const resolvedSeoDescription = seoDescription.trim().slice(0, CMS_LIMITS.seoDescription)
        || excerpt.trim().slice(0, CMS_LIMITS.seoDescription)
        || null;

      const shouldForceNoIndex = nextStatus !== CMS_STATUS.published;
      const payload = {
        title: normalizedTitle.slice(0, CMS_LIMITS.title),
        slug: normalizedSlug,
        status: nextStatus,
        excerpt: excerpt.trim().slice(0, CMS_LIMITS.excerpt) || null,
        contentJson: normalizedContentJson.slice(0, CMS_LIMITS.contentJson) || null,
        tags: normalizedTags,
        slugAliases,
        seriesSlug: toCmsSlug(seriesSlug) || null,
        authorName: authorName.trim() || user?.displayName || 'Admin',
        relatedPostSlugs,
        featuredUntil: parsedFeaturedUntil,
        categorySlug: categorySlug || null,
        coverImageUrl: coverImageUrl.trim() || null,
        featured,
        seoTitle: resolvedSeoTitle,
        seoDescription: resolvedSeoDescription,
        seoCanonicalUrl: seoCanonicalUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        seoNoIndex: shouldForceNoIndex ? true : seoNoIndex,
        seoNoFollow: shouldForceNoIndex ? true : seoNoFollow,
        ogTitle: ogTitle.trim().slice(0, CMS_LIMITS.seoTitle) || null,
        ogDescription: ogDescription.trim().slice(0, CMS_LIMITS.seoDescription) || null,
        ogImageUrl: ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || coverImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        twitterImageUrl: twitterImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || coverImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        workflowAssignee: workflowAssignee.trim() || null,
        reviewStatus,
        reviewNotes: reviewNotes.trim() || null,
        scheduledPublishAt: parsedScheduledPublishAt,
        scheduledUnpublishAt: parsedScheduledUnpublishAt,
        version: nextVersion,
        publishedAt,
        createdBy,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      };

      await setDoc(targetRef, payload, { merge: true });
      await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, getCmsPostDocId(normalizedSlug)), toCmsBlogSummaryPayload({
        ...payload,
        slug: normalizedSlug,
      }), { merge: true });
      const revisionId = `${normalizedSlug}_${Date.now()}`;
      const revisionEntry: ServerRevisionEntry = {
        id: revisionId,
        savedAt: new Date().toISOString(),
        title: normalizedTitle,
        status: nextStatus,
        excerpt: excerpt.trim(),
        contentJson: normalizedContentJson,
        savedBy: user?.uid || 'admin',
        version: nextVersion,
      };
      await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_REVISIONS, revisionId), {
        postSlug: normalizedSlug,
        savedAt: now,
        title: revisionEntry.title,
        status: revisionEntry.status,
        excerpt: revisionEntry.excerpt,
        contentJson: revisionEntry.contentJson,
        savedBy: revisionEntry.savedBy,
        version: revisionEntry.version,
      }, { merge: true });

      if (currentEntry?.id && currentEntry.id !== getCmsPostDocId(normalizedSlug)) {
        const canonicalRef = doc(db, COLLECTIONS.CMS_BLOG_POSTS, getCmsPostDocId(normalizedSlug));
        await setDoc(canonicalRef, payload, { merge: true });
        await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, currentEntry.id));
        await deleteDoc(targetRef);
      }

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey(draftScopeKey));
      }
      setStatus(nextStatus);
      setIsDirty(false);
      setLastSavedAt(Date.now());
      loadedUpdatedAtRef.current = Date.now();
      const nextRevision: RevisionEntry = {
        savedAt: new Date().toISOString(),
        title: normalizedTitle,
        status: nextStatus,
        excerpt: excerpt.trim(),
        contentJson: normalizedContentJson,
      };
      const nextHistory = [nextRevision, ...revisionHistory].slice(0, REVISION_LIMIT);
      setRevisionHistory(nextHistory);
      setServerRevisionHistory((prev) => [revisionEntry, ...prev].slice(0, 10));
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(revisionStorageKey(normalizedSlug), JSON.stringify(nextHistory));
        } catch {
          // keep save flow resilient when storage is unavailable
        }
      }
      notify.success(nextStatus === CMS_STATUS.published ? t('cms.postPublished') : t('cms.draftSaved'));

      const targetPath = ROUTES.portal.admin.dashboard.cmsBlogPostEditor.replace(':slug', normalizedSlug);
      if (normalizedParamSlug !== normalizedSlug) {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      recordCmsOperationFailure(
        'post_save',
        error instanceof Error ? error.message : 'Failed to save post.',
      );
      notify.error(error instanceof Error ? error.message : t('cms.savePostFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('cms.blogEditorTitle')}</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">{t('cms.blogEditorDescription')}</p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsBlogPosts}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('cms.backToBlogPosts')}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: 'content', label: t('cms.contentStep'), ready: guideState.contentReady },
              { id: 'media', label: t('cms.mediaStep'), ready: guideState.mediaReady },
              { id: 'seo', label: t('cms.seoStep'), ready: guideState.seoReady },
              { id: 'settings', label: t('cms.reviewPublishStep'), ready: guideState.reviewReady },
            ] as Array<{ id: EditorTab; label: string; ready: boolean }>).map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveTab(step.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  activeTab === step.id
                    ? 'border-red-600 bg-red-600 text-white'
                    : step.ready
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-gray-300 text-gray-700 dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-400">
            {autosaveSecondsAgo === null ? t('cms.autosaveWaiting') : t('cms.lastSavedSecondsAgo', { count: autosaveSecondsAgo })}
          </p>
        </div>
        {restoreDraftPayload ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p>{t('cms.recoveredUnsavedDraft')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const v = restoreDraftPayload;
                  setTitle(typeof v.title === 'string' ? v.title : title);
                  setSlug(typeof v.slug === 'string' ? toCmsSlug(v.slug) : slug);
                  setStatus(v.status === CMS_STATUS.published || v.status === CMS_STATUS.scheduled || v.status === CMS_STATUS.archived ? v.status : CMS_STATUS.draft);
                  setExcerpt(typeof v.excerpt === 'string' ? v.excerpt : excerpt);
                  setSeoTitle(typeof v.seoTitle === 'string' ? v.seoTitle : seoTitle);
                  setSeoDescription(typeof v.seoDescription === 'string' ? v.seoDescription : seoDescription);
                  setContentJson(typeof v.contentJson === 'string' ? toModernBlogContentJson(v.contentJson) : contentJson);
                  setTagsInput(typeof v.tagsInput === 'string' ? v.tagsInput : tagsInput);
                  setCategorySlug(typeof v.categorySlug === 'string' ? v.categorySlug : categorySlug);
                  setCoverImageUrl(typeof v.coverImageUrl === 'string' ? v.coverImageUrl : coverImageUrl);
                  setFeatured(v.featured === true);
                  setSeoCanonicalUrl(typeof v.seoCanonicalUrl === 'string' ? v.seoCanonicalUrl : seoCanonicalUrl);
                  setSeoNoIndex(v.seoNoIndex === true);
                  setSeoNoFollow(v.seoNoFollow === true);
                  setOgTitle(typeof v.ogTitle === 'string' ? v.ogTitle : ogTitle);
                  setOgDescription(typeof v.ogDescription === 'string' ? v.ogDescription : ogDescription);
                  setOgImageUrl(typeof v.ogImageUrl === 'string' ? v.ogImageUrl : ogImageUrl);
                  setTwitterImageUrl(typeof v.twitterImageUrl === 'string' ? v.twitterImageUrl : twitterImageUrl);
                  setWorkflowAssignee(typeof v.workflowAssignee === 'string' ? v.workflowAssignee : workflowAssignee);
                  setReviewStatus(
                    v.reviewStatus === CMS_REVIEW_STATUS.inReview
                    || v.reviewStatus === CMS_REVIEW_STATUS.approved
                    || v.reviewStatus === CMS_REVIEW_STATUS.changesRequested
                      ? v.reviewStatus
                      : CMS_REVIEW_STATUS.notRequested
                  );
                  setReviewNotes(typeof v.reviewNotes === 'string' ? v.reviewNotes : reviewNotes);
                  setScheduledPublishAt(typeof v.scheduledPublishAt === 'string' ? v.scheduledPublishAt : scheduledPublishAt);
                  setScheduledUnpublishAt(typeof v.scheduledUnpublishAt === 'string' ? v.scheduledUnpublishAt : scheduledUnpublishAt);
                  setSeriesSlug(typeof v.seriesSlug === 'string' ? v.seriesSlug : seriesSlug);
                  setAuthorName(typeof v.authorName === 'string' ? v.authorName : authorName);
                  setRelatedPostSlugsInput(typeof v.relatedPostSlugsInput === 'string' ? v.relatedPostSlugsInput : relatedPostSlugsInput);
                  setFeaturedUntil(typeof v.featuredUntil === 'string' ? v.featuredUntil : featuredUntil);
                  setRestoreDraftPayload(null);
                  setIsDirty(true);
                  notify.success(t('cms.recoveredDraftLoaded'));
                }}
                className="rounded-md border border-amber-300 px-2 py-1 font-semibold hover:bg-amber-100 dark:border-amber-900/40 dark:hover:bg-amber-950/40"
              >
                {t('cms.restoreDraft')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreDraftPayload(null);
                  if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(draftStorageKey(draftScopeKey));
                  }
                }}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cms.discardDraft')}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-3 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-950/70">
          {(['content', 'media', 'seo', 'settings'] as EditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${activeTab === tab ? 'bg-white text-red-700 shadow-sm dark:bg-slate-900 dark:text-red-300' : 'text-gray-600 dark:text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        {publishBlockers.length > 0 ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">{t('cms.readyToPublishChecklist')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {publishBlockers.slice(0, 4).map((blocker) => (
                <button
                  key={blocker}
                  type="button"
                  onClick={() => setActiveTab(blockerTabMap.get(blocker) || 'content')}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-left font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                >
                  {t('cms.fixPrefix', { value: blocker })}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            {t('cms.publishChecklistComplete')}
          </div>
        )}

        {activeTab === 'content' ? (
          <div className="grid gap-3 md:grid-cols-2">
            {CMS_FEATURE_FLAGS.blogEditorV2 ? (
              <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                {t('cms.editorV2Enabled')}
              </div>
            ) : null}
            {isNewPost ? (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.duplicateExistingPost')}</span>
                <select
                  value=""
                  onChange={(event) => {
                    const selected = rows.find((entry) => entry.slug === event.target.value);
                    if (!selected) return;
                    setTitle(`${selected.title} Copy`);
                    setSlug(toCmsSlug(`${selected.slug}-copy`));
                    setExcerpt(selected.excerpt || '');
                    setContentJson(toModernBlogContentJson(selected.contentJson || ''));
                    setTagsInput((selected.tags || []).join(', '));
                    setCategorySlug(selected.categorySlug || '');
                    setCoverImageUrl(selected.coverImageUrl || '');
                    setSeoTitle(selected.seoTitle || '');
                    setSeoDescription(selected.seoDescription || '');
                    setOgTitle(selected.ogTitle || '');
                    setOgDescription(selected.ogDescription || '');
                    setOgImageUrl(selected.ogImageUrl || '');
                    setTwitterImageUrl(selected.twitterImageUrl || '');
                    setSeriesSlug(selected.seriesSlug || '');
                    setAuthorName(selected.authorName || '');
                    setRelatedPostSlugsInput((selected.relatedPostSlugs || []).join(', '));
                    setIsDirty(true);
                    notify.success(t('cms.duplicatePostLoaded'));
                  }}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">{t('cms.selectExistingPost')}</option>
                  {rows.map((entry) => (
                    <option key={entry.id || entry.slug} value={entry.slug}>{entry.title}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.postTitle')}</span>
              <input value={title} onChange={(event) => { setTitle(event.target.value); setIsDirty(true); if (!slug) setSlug(toCmsSlug(event.target.value)); }} placeholder={t('cms.postTitlePlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              <span className={`mt-1 block text-[11px] ${titleLen > CMS_LIMITS.title ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{titleLen}/{CMS_LIMITS.title}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.postSlug')}</span>
              <input value={slug} onChange={(event) => { setSlug(toCmsSlug(event.target.value)); setIsDirty(true); }} placeholder={t('cms.postSlugPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.summary')}</span>
              <textarea value={excerpt} onChange={(event) => { setExcerpt(event.target.value); setIsDirty(true); }} rows={3} placeholder={t('cms.summaryPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              <span className={`mt-1 block text-[11px] ${excerptLen > CMS_LIMITS.excerpt ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{excerptLen}/{CMS_LIMITS.excerpt}</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.articleContent')}</span>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {t('cms.articleContentHint')}
                </p>
              </div>
              <CmsRichTextEditor
                value={parsedArticleContent.html}
                onChange={(nextHtml) => {
                  setContentJson(serializeCmsRichContent(nextHtml));
                  setIsDirty(true);
                }}
                placeholder={t('cms.articleContentPlaceholder')}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.tags')}</span>
              <input
                value={tagsInput}
                onChange={(event) => { setTagsInput(event.target.value); setIsDirty(true); }}
                placeholder={t('cms.tagsPlaceholder')}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">{t('cms.tagsHint', { count: CMS_LIMITS.tagsPerPost })}</span>
              {normalizedTags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {normalizedTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">#{tag}</span>
                  ))}
                </div>
              ) : null}
            </label>
            {linkSuggestions.length ? (
              <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">{t('cms.internalLinkSuggestions')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {linkSuggestions.map((entry) => (
                    <button
                      key={`${entry.source}-${entry.path}`}
                      type="button"
                      onClick={() => {
                        setContentJson((prev) => appendInternalLinkToCmsRichContent(prev, entry.label, entry.path));
                        setIsDirty(true);
                      }}
                      className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                    >
                      {t('cms.insertLinkSuggestion', { source: entry.source, label: entry.label })}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
              <p className="font-semibold">{t('cms.readability')}</p>
              <p className="mt-1">{t('cms.readabilitySummary', { words: readability.words, sentences: readability.sentences, minutes: readability.readingMinutes, level: readability.level, score: readability.score })}</p>
            </div>
          </div>
        ) : null}

        {activeTab === 'media' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.coverImageUrl')}</span>
              <input value={coverImageUrl} onChange={(event) => { setCoverImageUrl(event.target.value); setIsDirty(true); }} placeholder="https://..." className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <input type="checkbox" checked={featured} onChange={(event) => { setFeatured(event.target.checked); setIsDirty(true); }} />
              {t('cms.featuredPost')}
            </label>
          </div>
        ) : null}

        {activeTab === 'seo' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('cms.publishReadiness')}</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {publishChecks.critical.map((check) => (
                  <div key={check.id} className={`rounded px-2 py-1 text-xs ${check.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {check.passed ? t('cms.readyState') : t('cms.requiredState')}: {check.label}
                  </div>
                ))}
                {publishChecks.warnings.map((check) => (
                  <div key={check.id} className={`rounded px-2 py-1 text-xs ${check.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {check.passed ? t('cms.goodState') : t('cms.optionalState')}: {check.label}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">{t('cms.seoQualityScore', { score: seoAudit.score })}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.searchTitle')}</span>
                <input value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); setIsDirty(true); }} placeholder={t('cms.searchTitlePlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <span className={`mt-1 block text-[11px] ${seoTitleLen > CMS_LIMITS.seoTitle ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{seoTitleLen}/{CMS_LIMITS.seoTitle}</span>
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">{t('cms.recommendedCharacters', { min: CMS_SEO_GUIDELINES.titleMin, max: CMS_SEO_GUIDELINES.titleMax })}</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.searchDescription')}</span>
                <input value={seoDescription} onChange={(event) => { setSeoDescription(event.target.value); setIsDirty(true); }} placeholder={t('cms.searchDescriptionPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <span className={`mt-1 block text-[11px] ${seoDescLen > CMS_LIMITS.seoDescription ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{seoDescLen}/{CMS_LIMITS.seoDescription}</span>
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">{t('cms.recommendedCharacters', { min: CMS_SEO_GUIDELINES.descriptionMin, max: CMS_SEO_GUIDELINES.descriptionMax })}</span>
              </label>
            </div>
            <SeoSnippetPreview title={previewTitle} description={previewDescription} url={previewUrl} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSeoTitle((prev) => prev.trim() || title.trim().slice(0, CMS_LIMITS.seoTitle));
                  setIsDirty(true);
                }}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cms.usePostTitle')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeoDescription((prev) => prev.trim() || excerpt.trim().slice(0, CMS_LIMITS.seoDescription));
                  setIsDirty(true);
                }}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cms.useSummary')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOgImageUrl((prev) => prev.trim() || coverImageUrl.trim());
                  setTwitterImageUrl((prev) => prev.trim() || coverImageUrl.trim());
                  setIsDirty(true);
                }}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cms.useCoverImageForSocial')}
              </button>
            </div>
            {seoAudit.topFixes.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-semibold">{t('cms.topSeoFixes')}</p>
                <ul className="mt-1 list-disc pl-5">
                  {seoAudit.topFixes.map((fix) => <li key={fix}>{fix}</li>)}
                </ul>
              </div>
            ) : null}

            {CMS_FEATURE_FLAGS.simplifiedEditorMode ? (
              <button
                type="button"
                onClick={() => setShowAdvancedSeo((prev) => !prev)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {showAdvancedSeo ? t('cms.hideAdvancedSeo') : t('cms.showAdvancedSeo')}
              </button>
            ) : null}

            {(!CMS_FEATURE_FLAGS.simplifiedEditorMode || showAdvancedSeo) ? (
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950/70 md:grid-cols-2">
                <input value={seoCanonicalUrl} onChange={(event) => { setSeoCanonicalUrl(event.target.value); setIsDirty(true); }} placeholder={t('cms.canonicalUrlPlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                {canonicalConflictCount > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 md:col-span-2">
                    {t('cms.canonicalConflict', { count: canonicalConflictCount })}
                  </p>
                ) : null}
                <input value={ogTitle} onChange={(event) => { setOgTitle(event.target.value); setIsDirty(true); }} placeholder={t('cms.socialTitlePlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <input value={ogDescription} onChange={(event) => { setOgDescription(event.target.value); setIsDirty(true); }} placeholder={t('cms.socialDescriptionPlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <input value={ogImageUrl} onChange={(event) => { setOgImageUrl(event.target.value); setIsDirty(true); }} placeholder={t('cms.socialPreviewImagePlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <input value={twitterImageUrl} onChange={(event) => { setTwitterImageUrl(event.target.value); setIsDirty(true); }} placeholder={t('cms.twitterImagePlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <div className="flex items-center gap-4 rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoIndex} onChange={(event) => { setSeoNoIndex(event.target.checked); setIsDirty(true); }} />{t('cms.disableIndexing')}</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoFollow} onChange={(event) => { setSeoNoFollow(event.target.checked); setIsDirty(true); }} />{t('cms.disableLinkFollowing')}</label>
                </div>
                {status !== CMS_STATUS.published ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 md:col-span-2">{t('cms.draftNoindexHint')}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.category')}</span>
              <select value={categorySlug} onChange={(event) => { setCategorySlug(event.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <option value="">{t('cms.noCategory')}</option>
                {categoryOptions.map((entry) => <option key={entry.id} value={entry.slug}>{entry.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.seriesSlug')}</span>
              <input value={seriesSlug} onChange={(event) => { setSeriesSlug(toCmsSlug(event.target.value)); setIsDirty(true); }} placeholder={t('cms.seriesSlugPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.relatedPostSlugs')}</span>
              <input value={relatedPostSlugsInput} onChange={(event) => { setRelatedPostSlugsInput(event.target.value); setIsDirty(true); }} placeholder={t('cms.relatedPostSlugsPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">{t('cms.relatedPostsHint', { count: CMS_LIMITS.relatedPostsPerEntry })}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.authorName')}</span>
              <input value={authorName} onChange={(event) => { setAuthorName(event.target.value); setIsDirty(true); }} placeholder={t('cms.authorNamePlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('inventory.status')}</span>
              <select value={status} onChange={(event) => { setStatus(event.target.value as (typeof statusOptions)[number]); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                {statusOptions.map((entry) => <option key={entry} value={entry}>{toHumanCmsStatus(entry)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.featuredUntil')}</span>
              <input type="datetime-local" value={featuredUntil} onChange={(event) => { setFeaturedUntil(event.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.workflowAssignee')}</span>
              <input value={workflowAssignee} onChange={(event) => { setWorkflowAssignee(event.target.value); setIsDirty(true); }} placeholder={t('cms.workflowAssigneePlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.reviewStatus')}</span>
              <select value={reviewStatus} onChange={(event) => { setReviewStatus(event.target.value as (typeof CMS_REVIEW_STATUS)[keyof typeof CMS_REVIEW_STATUS]); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                {Object.values(CMS_REVIEW_STATUS).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.scheduledPublish')}</span>
              <input type="datetime-local" value={scheduledPublishAt} onChange={(event) => { setScheduledPublishAt(event.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.scheduledUnpublish')}</span>
              <input type="datetime-local" value={scheduledUnpublishAt} onChange={(event) => { setScheduledUnpublishAt(event.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.reviewNotes')}</span>
              <textarea value={reviewNotes} onChange={(event) => { setReviewNotes(event.target.value); setIsDirty(true); }} rows={3} placeholder={t('cms.reviewNotesPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </label>
            <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">{t('cms.savedVersionsLocal')}</p>
              {revisionHistory.length ? (
                <div className="mt-2 space-y-2">
                  {revisionHistory.map((entry, index) => (
                    <div key={`${entry.savedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <div className="text-xs text-gray-600 dark:text-slate-300">
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.title}</p>
                        <p>{new Date(entry.savedAt).toLocaleString()} · {toHumanCmsStatus(entry.status)}</p>
                        <p>
                          Content size: {extractCmsPlainText(entry.contentJson).trim().length} chars
                          {' · '}
                          Delta vs current: {extractCmsPlainText(entry.contentJson).trim().length - currentPlainLength}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t('cms.restoreRevisionConfirm'))) return;
                          setTitle(entry.title);
                          setExcerpt(entry.excerpt);
                          setContentJson(toModernBlogContentJson(entry.contentJson));
                          setIsDirty(true);
                        }}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('cms.restore')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t('cms.noLocalRevisions')}</p>
              )}
            </div>
            <div className="md:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-700 dark:text-indigo-300">{t('cms.savedVersionsServer')}</p>
              {serverRevisionHistory.length ? (
                <div className="mt-2 space-y-2">
                  {serverRevisionHistory.map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 dark:border-indigo-900/40 dark:bg-slate-900">
                      <div className="text-xs text-gray-600 dark:text-slate-300">
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.title}</p>
                        <p>{new Date(entry.savedAt).toLocaleString()} · {toHumanCmsStatus(entry.status)} · v{entry.version} · {entry.savedBy}</p>
                        <p>
                          Content size: {extractCmsPlainText(entry.contentJson).trim().length} chars
                          {' · '}
                          Delta vs current: {extractCmsPlainText(entry.contentJson).trim().length - currentPlainLength}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t('cms.restoreServerRevisionConfirm'))) return;
                          setTitle(entry.title);
                          setExcerpt(entry.excerpt);
                          setContentJson(toModernBlogContentJson(entry.contentJson));
                          setStatus(entry.status as (typeof statusOptions)[number]);
                          setIsDirty(true);
                        }}
                        className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                      >
                        {t('cms.restore')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-300/80">{t('cms.noServerRevisions')}</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void savePost(CMS_STATUS.draft)} disabled={saving} className="rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.draft ? t('cms.saveDrafting') : t('cms.saveDraft')}
          </button>
          <button type="button" onClick={() => void savePost(CMS_STATUS.published)} disabled={saving || publishBlockers.length > 0 || settingsQuery.isLoading || settingsQuery.isFetching} className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.published ? t('cms.publishing') : t('cms.publish')}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsBlogPosts)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-slate-700 dark:text-slate-200"
          >
            {t('common.cancel')}
          </button>
        </div>
        {publishBlockers.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">{t('cms.publishBlockers')}</p>
            <ul className="mt-1 list-disc pl-5">
              {publishBlockers.slice(0, 6).map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

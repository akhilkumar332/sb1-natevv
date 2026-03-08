import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import {
  CMS_FEATURE_FLAGS,
  CMS_FRONTEND_PAGE_PRESETS,
  CMS_EDITOR,
  CMS_LIMITS,
  CMS_PAGE_KIND,
  CMS_REVIEW_STATUS,
  CMS_SEO_GUIDELINES,
  CMS_STATUS,
  getCmsPageDocId,
  toCmsSlug,
} from '../../../constants/cms';
import { CMS_FRONTEND_PAGE_DEFAULT_CONTENT } from '../../../constants/cmsPageDefaults';
import { useAdminCmsBlogPosts, useAdminCmsPages, useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { resolveCmsFrontendContent } from '../../../utils/cmsFrontendContent';
import { ROUTES } from '../../../constants/routes';
import { toDateValue } from '../../../utils/dateValue';
import { runSeoAudit } from '../../../utils/seoAudit';
import SeoSnippetPreview from '../../../components/cms/SeoSnippetPreview';

const statusOptions = Object.values(CMS_STATUS);
const kindOptions = Object.values(CMS_PAGE_KIND);
type RevisionEntry = {
  savedAt: string;
  title: string;
  status: string;
  excerpt: string;
  contentJson: string;
};
const REVISION_LIMIT = 10;
const revisionStorageKey = (slug: string) => `cms_page_revisions_${slug}`;
const draftStorageKey = (scope: string) => `cms_page_draft_${scope}`;

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };
type JsonPath = Array<string | number>;

const isPlainObject = (value: unknown): value is Record<string, JsonLike> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseJsonObject = (value: string): Record<string, JsonLike> | null => {
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());
const isMediaUrlOrPath = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return true;
  return normalized.startsWith('/') || isAbsoluteHttpUrl(normalized);
};
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

const toSectionLabel = (key: string): string => (
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const setAtPath = (input: JsonLike, path: JsonPath, nextValue: JsonLike): JsonLike => {
  if (path.length === 0) return nextValue;
  const [head, ...tail] = path;
  if (Array.isArray(input)) {
    const index = Number(head);
    const copy = [...input];
    copy[index] = setAtPath(copy[index] as JsonLike, tail, nextValue);
    return copy;
  }
  const base = isPlainObject(input) ? input : {};
  return {
    ...base,
    [String(head)]: setAtPath((base as Record<string, JsonLike>)[String(head)] as JsonLike, tail, nextValue),
  };
};

const removeArrayIndexAtPath = (input: JsonLike, path: JsonPath, indexToRemove: number): JsonLike => {
  if (path.length === 0) {
    if (!Array.isArray(input)) return input;
    return input.filter((_, index) => index !== indexToRemove);
  }
  const [head, ...tail] = path;
  if (Array.isArray(input)) {
    const index = Number(head);
    const copy = [...input];
    copy[index] = removeArrayIndexAtPath(copy[index] as JsonLike, tail, indexToRemove);
    return copy;
  }
  const base = isPlainObject(input) ? input : {};
  return {
    ...base,
    [String(head)]: removeArrayIndexAtPath((base as Record<string, JsonLike>)[String(head)] as JsonLike, tail, indexToRemove),
  };
};

const addArrayItemAtPath = (input: JsonLike, path: JsonPath, newItem: JsonLike): JsonLike => {
  if (path.length === 0) {
    if (!Array.isArray(input)) return [newItem];
    return [...input, newItem];
  }
  const [head, ...tail] = path;
  if (Array.isArray(input)) {
    const index = Number(head);
    const copy = [...input];
    copy[index] = addArrayItemAtPath(copy[index] as JsonLike, tail, newItem);
    return copy;
  }
  const base = isPlainObject(input) ? input : {};
  return {
    ...base,
    [String(head)]: addArrayItemAtPath((base as Record<string, JsonLike>)[String(head)] as JsonLike, tail, newItem),
  };
};

export default function CmsPageEditorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams<{ slug: string }>();
  const pagesQuery = useAdminCmsPages();
  const postsQuery = useAdminCmsBlogPosts();
  const settingsQuery = useAdminCmsSettings();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState<(typeof kindOptions)[number]>(CMS_PAGE_KIND.generic);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.draft);
  const [excerpt, setExcerpt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
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
  const [contentJson, setContentJson] = useState('');
  const [contentDraft, setContentDraft] = useState<JsonLike>({});
  const [revisionHistory, setRevisionHistory] = useState<RevisionEntry[]>([]);
  const [restoreDraftPayload, setRestoreDraftPayload] = useState<Record<string, unknown> | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showAdvancedSeo, setShowAdvancedSeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const hasHydratedDraftRef = useRef(false);

  const rows = useMemo(() => pagesQuery.data || [], [pagesQuery.data]);
  const normalizedParamSlug = toCmsSlug(slugParam || '');
  const isNewPage = normalizedParamSlug === 'new' || !normalizedParamSlug;
  const existingForSlug = useMemo(
    () => rows.find((entry) => entry.slug === normalizedParamSlug),
    [rows, normalizedParamSlug]
  );
  const existingRevisionKey = useMemo(() => {
    if (!existingForSlug) return 'none';
    const updatedAt = toDateValue(existingForSlug.updatedAt);
    return `${existingForSlug.id}:${updatedAt?.getTime() ?? 'no-updated-at'}`;
  }, [existingForSlug]);

  useEffect(() => {
    setIsDirty(false);
    setInitializedFor(null);
    hasHydratedDraftRef.current = false;
    setRestoreDraftPayload(null);
  }, [slugParam]);
  const activePreset = useMemo(
    () => CMS_FRONTEND_PAGE_PRESETS.find((preset) => preset.slug === toCmsSlug(slug)),
    [slug]
  );
  const contentSections = useMemo(
    () => (isPlainObject(contentDraft) ? Object.keys(contentDraft) : []),
    [contentDraft]
  );
  const activePresetPath = activePreset?.path || null;
  const resolvedContentJsonForChecks = advancedMode ? contentJson : JSON.stringify(contentDraft || {});
  const seoTitleLen = (seoTitle.trim() || title.trim()).length;
  const seoDescriptionLen = (seoDescription.trim() || excerpt.trim()).length;
  const publishChecks = useMemo(() => {
    const critical = [
      { id: 'title', label: 'Page title is set', passed: Boolean(title.trim()) },
      { id: 'slug', label: 'Page slug is valid', passed: Boolean(toCmsSlug(slug || title)) },
      { id: 'content', label: 'Content is present', passed: Boolean((advancedMode ? contentJson : JSON.stringify(contentDraft || {})).trim() && (advancedMode ? contentJson : JSON.stringify(contentDraft || {})) !== '{}' ) },
    ];
    const warnings = [
      { id: 'excerpt', label: 'Summary is added', passed: Boolean(excerpt.trim()) },
      {
        id: 'seoTitle',
        label: `Search title is in range (${CMS_SEO_GUIDELINES.titleMin}-${CMS_SEO_GUIDELINES.titleMax})`,
        passed: seoTitleLen >= CMS_SEO_GUIDELINES.titleMin && seoTitleLen <= CMS_SEO_GUIDELINES.titleMax,
      },
      {
        id: 'seoDesc',
        label: `Search description is in range (${CMS_SEO_GUIDELINES.descriptionMin}-${CMS_SEO_GUIDELINES.descriptionMax})`,
        passed: seoDescriptionLen >= CMS_SEO_GUIDELINES.descriptionMin && seoDescriptionLen <= CMS_SEO_GUIDELINES.descriptionMax,
      },
    ];
    return { critical, warnings };
  }, [advancedMode, contentDraft, contentJson, excerpt, seoDescriptionLen, seoTitleLen, slug, title]);
  const canPublish = publishChecks.critical.every((entry) => entry.passed);
  const previewTitle = (seoTitle.trim() || title.trim() || 'Untitled page').slice(0, CMS_LIMITS.seoTitle);
  const previewDescription = (
    seoDescription.trim()
    || excerpt.trim()
    || 'Add a short description so this page is clearer in search results.'
  ).slice(0, CMS_LIMITS.seoDescription);
  const previewSlug = toCmsSlug(slug || title) || 'untitled-page';
  const draftScopeKey = isNewPage ? `new_${toCmsSlug(slugParam || 'new') || 'new'}` : (normalizedParamSlug || previewSlug);
  const previewPath = activePresetPath || (previewSlug === 'home' ? '/' : `/${previewSlug}`);
  const previewUrl = `https://bloodhubindia.com${previewPath}`;
  const seoAudit = runSeoAudit({
    title,
    seoTitle,
    slug,
    excerpt,
    seoDescription,
    contentJson: resolvedContentJsonForChecks,
    coverImageUrl: '',
    ogImageUrl,
  });
  const canonicalConflictCount = useMemo(() => {
    const canonical = seoCanonicalUrl.trim().toLowerCase();
    if (!canonical) return 0;
    const ownId = existingForSlug?.id || '';
    const inPages = rows.filter((entry) => entry.id !== ownId && (entry.seoCanonicalUrl || '').trim().toLowerCase() === canonical).length;
    const inPosts = (postsQuery.data || []).filter((entry) => (entry.seoCanonicalUrl || '').trim().toLowerCase() === canonical).length;
    return inPages + inPosts;
  }, [seoCanonicalUrl, existingForSlug?.id, rows, postsQuery.data]);

  const hydrateContentEditor = (targetSlug: string, rawContentJson: string) => {
    const normalizedSlug = toCmsSlug(targetSlug);
    const preset = CMS_FRONTEND_PAGE_PRESETS.find((entry) => entry.slug === normalizedSlug);
    if (!preset) {
      const parsed = parseJsonObject(rawContentJson) || {};
      setContentDraft(parsed);
      setContentJson(rawContentJson || JSON.stringify(parsed, null, 2));
      return;
    }
    const fallback = CMS_FRONTEND_PAGE_DEFAULT_CONTENT[preset.slug as keyof typeof CMS_FRONTEND_PAGE_DEFAULT_CONTENT] as unknown as Record<string, JsonLike>;
    const merged = resolveCmsFrontendContent(rawContentJson, fallback);
    setContentDraft(merged as JsonLike);
    setContentJson(JSON.stringify(merged, null, 2));
  };

  useEffect(() => {
    if (!slugParam) return;
    const hydrationKey = isNewPage ? `new:${slugParam}` : `${slugParam}:${existingRevisionKey}`;
    if (initializedFor === hydrationKey) return;
    if (isDirty) return;
    if (!isNewPage && (pagesQuery.isLoading || pagesQuery.isFetching)) return;

    if (isNewPage) {
      setTitle('');
      setSlug('');
      setKind(CMS_PAGE_KIND.generic);
      setStatus(CMS_STATUS.draft);
      setExcerpt('');
      setSeoTitle('');
      setSeoDescription('');
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
      setContentDraft({});
      setContentJson('{}');
      setRevisionHistory([]);
      setInitializedFor(hydrationKey);
      setIsDirty(false);
      return;
    }

    const existing = existingForSlug;
    const preset = CMS_FRONTEND_PAGE_PRESETS.find((entry) => entry.slug === normalizedParamSlug);
    setTitle(existing?.title || preset?.label || normalizedParamSlug);
    setSlug(normalizedParamSlug);
    setKind(existing?.kind || preset?.kind || CMS_PAGE_KIND.generic);
    setStatus(existing?.status || CMS_STATUS.draft);
    setExcerpt(existing?.excerpt || '');
    setSeoTitle(existing?.seoTitle || '');
    setSeoDescription(existing?.seoDescription || '');
    setSeoCanonicalUrl(existing?.seoCanonicalUrl || '');
    setSeoNoIndex(existing?.seoNoIndex === true);
    setSeoNoFollow(existing?.seoNoFollow === true);
    setOgTitle(existing?.ogTitle || '');
    setOgDescription(existing?.ogDescription || '');
    setOgImageUrl(existing?.ogImageUrl || '');
    setTwitterImageUrl(existing?.twitterImageUrl || '');
    setWorkflowAssignee(existing?.workflowAssignee || '');
    setReviewStatus(existing?.reviewStatus || CMS_REVIEW_STATUS.notRequested);
    setReviewNotes(existing?.reviewNotes || '');
    setScheduledPublishAt(toDateTimeLocalValue(existing?.scheduledPublishAt));
    setScheduledUnpublishAt(toDateTimeLocalValue(existing?.scheduledUnpublishAt));
    const rawContentJson = typeof existing?.contentJson === 'string'
      ? existing.contentJson
      : JSON.stringify(
        CMS_FRONTEND_PAGE_DEFAULT_CONTENT[normalizedParamSlug as keyof typeof CMS_FRONTEND_PAGE_DEFAULT_CONTENT] || {},
        null,
        2
      );
    hydrateContentEditor(normalizedParamSlug, rawContentJson);
    setInitializedFor(hydrationKey);
    setIsDirty(false);
  }, [isNewPage, normalizedParamSlug, pagesQuery.isLoading, pagesQuery.isFetching, slugParam, initializedFor, existingForSlug, existingRevisionKey, isDirty]);

  useEffect(() => {
    if (!contentSections.length) {
      setActiveSection('');
      return;
    }
    if (!activeSection || !contentSections.includes(activeSection)) {
      setActiveSection(contentSections[0]);
    }
  }, [activeSection, contentSections]);

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
      // ignore invalid local draft data
    }
  }, [draftScopeKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isDirty) return;
    const timer = window.setTimeout(() => {
      const values = {
        title,
        slug,
        kind,
        status,
        excerpt,
        seoTitle,
        seoDescription,
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
        contentJson,
        contentDraft,
      };
      try {
        window.localStorage.setItem(draftStorageKey(draftScopeKey), JSON.stringify({ savedAt: Date.now(), values }));
      } catch {
        // keep autosave best-effort
      }
    }, CMS_EDITOR.autosaveDebounceMs);
    return () => window.clearTimeout(timer);
  }, [
    isDirty,
    draftScopeKey,
    title,
    slug,
    kind,
    status,
    excerpt,
    seoTitle,
    seoDescription,
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
    contentJson,
    contentDraft,
  ]);

  const updateDraftAtPath = (path: JsonPath, nextValue: JsonLike) => {
    setIsDirty(true);
    setContentDraft((prev) => setAtPath(prev || {}, path, nextValue));
  };

  const removeDraftArrayItem = (path: JsonPath, index: number) => {
    setIsDirty(true);
    setContentDraft((prev) => removeArrayIndexAtPath(prev || {}, path, index));
  };

  const addDraftArrayItem = (path: JsonPath, sample: JsonLike) => {
    setIsDirty(true);
    const template = sample === null || sample === undefined
      ? ''
      : (Array.isArray(sample) ? [] : (isPlainObject(sample) ? {} : sample));
    setContentDraft((prev) => addArrayItemAtPath(prev || {}, path, template));
  };

  const moveTopLevelSection = (sourceKey: string, direction: 'up' | 'down') => {
    if (!isPlainObject(contentDraft)) return;
    const entries = Object.entries(contentDraft);
    const sourceIndex = entries.findIndex(([key]) => key === sourceKey);
    if (sourceIndex < 0) return;
    const targetIndex = direction === 'up' ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= entries.length) return;
    const next = [...entries];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setContentDraft(Object.fromEntries(next));
    setIsDirty(true);
  };

  const duplicateTopLevelSection = (sourceKey: string) => {
    if (!isPlainObject(contentDraft)) return;
    const sourceValue = contentDraft[sourceKey];
    if (typeof sourceValue === 'undefined') return;
    let copyKey = `${sourceKey}Copy`;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(contentDraft, copyKey)) {
      copyKey = `${sourceKey}Copy${suffix}`;
      suffix += 1;
    }
    setContentDraft({
      ...contentDraft,
      [copyKey]: sourceValue,
    });
    setActiveSection(copyKey);
    setIsDirty(true);
  };

  const addTopLevelSection = () => {
    if (!isPlainObject(contentDraft)) return;
    let sectionName = 'newSection';
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(contentDraft, sectionName)) {
      sectionName = `newSection${suffix}`;
      suffix += 1;
    }
    setContentDraft({
      ...contentDraft,
      [sectionName]: { title: '', body: '' },
    });
    setActiveSection(sectionName);
    setIsDirty(true);
  };

  const renderJsonField = (label: string, value: JsonLike, path: JsonPath): JSX.Element => {
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">{label}</p>
            <button
              type="button"
              onClick={() => addDraftArrayItem(path, value[0] ?? '')}
              className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
            >
              Add item
            </button>
          </div>
          {value.map((item, index) => (
            <div key={`${label}-${index}`} className="rounded-lg border border-gray-100 p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-500">Item {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeDraftArrayItem(path, index)}
                  className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
              {renderJsonField(`${label}-${index}`, item, [...path, index])}
            </div>
          ))}
          {value.length === 0 && <p className="text-xs text-gray-500">No items yet.</p>}
        </div>
      );
    }

    if (isPlainObject(value)) {
      return (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">{label}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(value).map(([childKey, childValue]) => (
              <div key={`${label}-${childKey}`} className="md:col-span-2">
                {renderJsonField(childKey, childValue, [...path, childKey])}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={value}
            onChange={(event) => updateDraftAtPath(path, event.target.checked)}
          />
          {label}
        </label>
      );
    }

    if (typeof value === 'number') {
      return (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">{label}</span>
          <input
            type="number"
            value={value}
            onChange={(event) => updateDraftAtPath(path, Number(event.target.value || 0))}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      );
    }

    const normalizedValue = typeof value === 'string' ? value : '';
    const multiline = normalizedValue.length > 80 || normalizedValue.includes('\n');
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">{label}</span>
        {multiline ? (
          <textarea
            value={normalizedValue}
            onChange={(event) => updateDraftAtPath(path, event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        ) : (
          <input
            value={normalizedValue}
            onChange={(event) => updateDraftAtPath(path, event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        )}
      </label>
    );
  };

  const savePage = async (targetStatus?: (typeof statusOptions)[number]) => {
    const normalizedTitle = title.trim();
    const normalizedSlug = toCmsSlug(slug || title);
    const nextStatus = targetStatus || status;
    if (!normalizedTitle) {
      notify.error('Page title is required.');
      return;
    }
    if (!normalizedSlug) {
      notify.error('Valid page slug is required.');
      return;
    }
    if (nextStatus === CMS_STATUS.published && !canPublish) {
      notify.error('Please complete required publish checklist items.');
      return;
    }
    if (nextStatus === CMS_STATUS.published && (settingsQuery.isLoading || settingsQuery.isFetching)) {
      notify.error('Please wait for CMS settings to load before publishing.');
      return;
    }
    if (
      nextStatus === CMS_STATUS.published
      && settingsQuery.data?.requireApprovalBeforePublish
      && reviewStatus !== CMS_REVIEW_STATUS.approved
    ) {
      notify.error('Publishing requires review approval. Set review status to approved first.');
      return;
    }

    const duplicate = rows.find((entry) => (
      entry.slug === normalizedSlug
      && entry.slug !== normalizedParamSlug
    ));
    if (duplicate) {
      notify.error('A page with this slug already exists. Please use a unique slug.');
      return;
    }

    const normalizedContentJson = advancedMode
      ? contentJson.trim()
      : JSON.stringify(contentDraft || {}, null, 2);

    if (advancedMode) {
      const parsed = parseJsonObject(normalizedContentJson);
      if (!parsed) {
        notify.error('Advanced JSON must be a valid JSON object.');
        return;
      }
    }

    if (normalizedContentJson.length > CMS_LIMITS.contentJson) {
      notify.error(`Content JSON exceeds ${CMS_LIMITS.contentJson} characters.`);
      return;
    }
    if (seoCanonicalUrl.trim() && !isAbsoluteHttpUrl(seoCanonicalUrl)) {
      notify.error('Canonical URL must start with http:// or https://');
      return;
    }
    if (!isMediaUrlOrPath(ogImageUrl) || !isMediaUrlOrPath(twitterImageUrl)) {
      notify.error('Social image URLs must be absolute URLs or start with /.');
      return;
    }
    const parsedScheduledPublishAt = scheduledPublishAt ? new Date(scheduledPublishAt) : null;
    const parsedScheduledUnpublishAt = scheduledUnpublishAt ? new Date(scheduledUnpublishAt) : null;
    if (parsedScheduledPublishAt && Number.isNaN(parsedScheduledPublishAt.getTime())) {
      notify.error('Scheduled publish date/time is invalid.');
      return;
    }
    if (parsedScheduledUnpublishAt && Number.isNaN(parsedScheduledUnpublishAt.getTime())) {
      notify.error('Scheduled unpublish date/time is invalid.');
      return;
    }
    if (parsedScheduledPublishAt && parsedScheduledUnpublishAt && parsedScheduledUnpublishAt.getTime() <= parsedScheduledPublishAt.getTime()) {
      notify.error('Scheduled unpublish must be after scheduled publish.');
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      const currentEntry = rows.find((entry) => entry.slug === normalizedParamSlug);
      const targetRef = doc(
        db,
        COLLECTIONS.CMS_PAGES,
        currentEntry?.id || getCmsPageDocId(normalizedSlug)
      );
      const existing = await getDoc(targetRef);
      const existingData = existing.exists() ? existing.data() : null;
      const createdAt = existingData?.createdAt || now;
      const createdBy = existingData?.createdBy || user?.uid || 'admin';
      const publishedAt = nextStatus === CMS_STATUS.published ? (existingData?.publishedAt || now) : null;
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
      const resolvedSeoDescription = seoDescription.trim().slice(0, CMS_LIMITS.seoDescription) || excerpt.trim().slice(0, CMS_LIMITS.seoDescription) || null;

      const shouldForceNoIndex = nextStatus !== CMS_STATUS.published;
      await setDoc(targetRef, {
        slug: normalizedSlug,
        title: normalizedTitle.slice(0, CMS_LIMITS.title),
        kind,
        status: nextStatus,
        slugAliases,
        excerpt: excerpt.trim().slice(0, CMS_LIMITS.excerpt) || null,
        seoTitle: resolvedSeoTitle,
        seoDescription: resolvedSeoDescription,
        seoCanonicalUrl: seoCanonicalUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        seoNoIndex: shouldForceNoIndex ? true : seoNoIndex,
        seoNoFollow: shouldForceNoIndex ? true : seoNoFollow,
        ogTitle: ogTitle.trim().slice(0, CMS_LIMITS.seoTitle) || null,
        ogDescription: ogDescription.trim().slice(0, CMS_LIMITS.seoDescription) || null,
        ogImageUrl: ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        twitterImageUrl: twitterImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        workflowAssignee: workflowAssignee.trim() || null,
        reviewStatus,
        reviewNotes: reviewNotes.trim() || null,
        scheduledPublishAt: parsedScheduledPublishAt,
        scheduledUnpublishAt: parsedScheduledUnpublishAt,
        version: nextVersion,
        contentJson: normalizedContentJson || null,
        publishedAt,
        createdBy,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      }, { merge: true });

      if (currentEntry?.id && currentEntry.id !== getCmsPageDocId(normalizedSlug)) {
        const canonicalRef = doc(db, COLLECTIONS.CMS_PAGES, getCmsPageDocId(normalizedSlug));
        await setDoc(canonicalRef, {
          slug: normalizedSlug,
          title: normalizedTitle.slice(0, CMS_LIMITS.title),
          kind,
          status: nextStatus,
          slugAliases,
          excerpt: excerpt.trim().slice(0, CMS_LIMITS.excerpt) || null,
          seoTitle: resolvedSeoTitle,
          seoDescription: resolvedSeoDescription,
          seoCanonicalUrl: seoCanonicalUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
          seoNoIndex: shouldForceNoIndex ? true : seoNoIndex,
          seoNoFollow: shouldForceNoIndex ? true : seoNoFollow,
          ogTitle: ogTitle.trim().slice(0, CMS_LIMITS.seoTitle) || null,
          ogDescription: ogDescription.trim().slice(0, CMS_LIMITS.seoDescription) || null,
          ogImageUrl: ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
          twitterImageUrl: twitterImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
          workflowAssignee: workflowAssignee.trim() || null,
          reviewStatus,
          reviewNotes: reviewNotes.trim() || null,
          scheduledPublishAt: parsedScheduledPublishAt,
          scheduledUnpublishAt: parsedScheduledUnpublishAt,
          version: nextVersion,
          contentJson: normalizedContentJson || null,
          publishedAt,
          createdBy,
          updatedBy: user?.uid || 'admin',
          createdAt,
          updatedAt: now,
        }, { merge: true });
        await deleteDoc(targetRef);
      }

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey(draftScopeKey));
      }
      setIsDirty(false);
      setStatus(nextStatus);
      const nextRevision: RevisionEntry = {
        savedAt: new Date().toISOString(),
        title: normalizedTitle,
        status: nextStatus,
        excerpt: excerpt.trim(),
        contentJson: normalizedContentJson,
      };
      const nextHistory = [nextRevision, ...revisionHistory].slice(0, REVISION_LIMIT);
      setRevisionHistory(nextHistory);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(revisionStorageKey(normalizedSlug), JSON.stringify(nextHistory));
        } catch {
          // keep save flow resilient if storage is unavailable
        }
      }
      notify.success(nextStatus === CMS_STATUS.published ? 'Page published.' : 'Draft saved.');

      const targetPath = ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', normalizedSlug);
      if (normalizedParamSlug !== normalizedSlug) {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save page.');
    } finally {
      setSaving(false);
    }
  };

  const loadDefaultContent = () => {
    if (activePreset) {
      const fallback = CMS_FRONTEND_PAGE_DEFAULT_CONTENT[activePreset.slug as keyof typeof CMS_FRONTEND_PAGE_DEFAULT_CONTENT];
      setContentDraft(fallback as unknown as JsonLike);
      setContentJson(JSON.stringify(fallback, null, 2));
      setIsDirty(true);
      if (isPlainObject(fallback)) {
        const keys = Object.keys(fallback);
        setActiveSection(keys[0] || '');
      }
      notify.success('Loaded default content sections.');
      return;
    }

    const starter = { headline: '', body: '' };
    setContentDraft(starter);
    setContentJson(JSON.stringify(starter, null, 2));
    setIsDirty(true);
    setActiveSection('headline');
    notify.success('Loaded starter content object.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Page Editor</h2>
            <p className="text-sm text-gray-600">
              {activePreset ? `Editing ${activePreset.label}` : 'Edit page content in a dedicated editor view.'}
            </p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsPages}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Pages
          </Link>
          {activePresetPath ? (
            <Link
              to={`${activePresetPath}?edit=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Open Live Visual Editor
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        {restoreDraftPayload ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>Recovered a local unsaved draft for this page.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const v = restoreDraftPayload;
                  setTitle(typeof v.title === 'string' ? v.title : title);
                  setSlug(typeof v.slug === 'string' ? toCmsSlug(v.slug) : slug);
                  setKind(
                    v.kind === CMS_PAGE_KIND.homeSection
                    || v.kind === CMS_PAGE_KIND.aboutSection
                    || v.kind === CMS_PAGE_KIND.contactSection
                      ? v.kind
                      : CMS_PAGE_KIND.generic
                  );
                  setStatus(v.status === CMS_STATUS.published || v.status === CMS_STATUS.scheduled || v.status === CMS_STATUS.archived ? v.status : CMS_STATUS.draft);
                  setExcerpt(typeof v.excerpt === 'string' ? v.excerpt : excerpt);
                  setSeoTitle(typeof v.seoTitle === 'string' ? v.seoTitle : seoTitle);
                  setSeoDescription(typeof v.seoDescription === 'string' ? v.seoDescription : seoDescription);
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
                  if (v.contentDraft && typeof v.contentDraft === 'object' && !Array.isArray(v.contentDraft)) {
                    setContentDraft(v.contentDraft as JsonLike);
                    setContentJson(JSON.stringify(v.contentDraft, null, 2));
                  } else if (typeof v.contentJson === 'string') {
                    setContentJson(v.contentJson);
                    const parsed = parseJsonObject(v.contentJson);
                    if (parsed) setContentDraft(parsed);
                  }
                  setRestoreDraftPayload(null);
                  setIsDirty(true);
                  notify.success('Recovered local draft loaded.');
                }}
                className="rounded-md border border-amber-300 px-2 py-1 font-semibold hover:bg-amber-100"
              >
                Restore Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreDraftPayload(null);
                  if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(draftStorageKey(draftScopeKey));
                  }
                }}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Page Editor</p>
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(event) => {
                const next = event.target.checked;
                setIsDirty(true);
                setAdvancedMode(next);
                if (next) {
                  setContentJson(JSON.stringify(contentDraft || {}, null, 2));
                } else {
                  const parsed = parseJsonObject(contentJson);
                  if (parsed) setContentDraft(parsed);
                }
              }}
            />
            Developer Mode JSON
          </label>
        </div>
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-900">Publish Readiness</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {publishChecks.critical.map((check) => (
              <div key={check.id} className={`rounded px-2 py-1 text-xs ${check.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {check.passed ? 'Ready' : 'Required'}: {check.label}
              </div>
            ))}
            {publishChecks.warnings.map((check) => (
              <div key={check.id} className={`rounded px-2 py-1 text-xs ${check.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {check.passed ? 'Good' : 'Optional'}: {check.label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {isNewPage ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Duplicate From Existing Page (Optional)</span>
              <select
                value=""
                onChange={(event) => {
                  const selected = rows.find((entry) => entry.slug === event.target.value);
                  if (!selected) return;
                  setTitle(`${selected.title} Copy`);
                  setSlug(toCmsSlug(`${selected.slug}-copy`));
                  setKind(selected.kind || CMS_PAGE_KIND.generic);
                  setExcerpt(selected.excerpt || '');
                  setSeoTitle(selected.seoTitle || '');
                  setSeoDescription(selected.seoDescription || '');
                  setSeoCanonicalUrl(selected.seoCanonicalUrl || '');
                  setSeoNoIndex(selected.seoNoIndex === true);
                  setSeoNoFollow(selected.seoNoFollow === true);
                  setOgTitle(selected.ogTitle || '');
                  setOgDescription(selected.ogDescription || '');
                  setOgImageUrl(selected.ogImageUrl || '');
                  setTwitterImageUrl(selected.twitterImageUrl || '');
                  setContentJson(selected.contentJson || '{}');
                  const parsed = parseJsonObject(selected.contentJson || '{}');
                  if (parsed) setContentDraft(parsed);
                  setIsDirty(true);
                  notify.success('Page content duplicated. Update title/slug before saving.');
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select an existing page</option>
                {rows.map((entry) => (
                  <option key={entry.id || entry.slug} value={entry.slug}>{entry.title}</option>
                ))}
              </select>
            </label>
          ) : null}
          <input
            value={title}
            onChange={(event) => { setTitle(event.target.value); setIsDirty(true); }}
            placeholder="Page title"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={slug}
            onChange={(event) => { setSlug(toCmsSlug(event.target.value)); setIsDirty(true); }}
            placeholder="page-slug"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <select value={kind} onChange={(event) => { setKind(event.target.value as (typeof kindOptions)[number]); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
            {kindOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as (typeof statusOptions)[number]); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
            {statusOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <input value={workflowAssignee} onChange={(event) => { setWorkflowAssignee(event.target.value); setIsDirty(true); }} placeholder="Workflow assignee (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <select value={reviewStatus} onChange={(event) => { setReviewStatus(event.target.value as (typeof CMS_REVIEW_STATUS)[keyof typeof CMS_REVIEW_STATUS]); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
            {Object.values(CMS_REVIEW_STATUS).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <input type="datetime-local" value={scheduledPublishAt} onChange={(event) => { setScheduledPublishAt(event.target.value); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <input type="datetime-local" value={scheduledUnpublishAt} onChange={(event) => { setScheduledUnpublishAt(event.target.value); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <input value={excerpt} onChange={(event) => { setExcerpt(event.target.value); setIsDirty(true); }} placeholder="Summary (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
          <textarea value={reviewNotes} onChange={(event) => { setReviewNotes(event.target.value); setIsDirty(true); }} placeholder="Review notes (optional)" rows={2} className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
              <div className="space-y-1">
                <input value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); setIsDirty(true); }} placeholder="Search title (optional)" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <span className="block text-[11px] text-gray-500">Recommended {CMS_SEO_GUIDELINES.titleMin}-{CMS_SEO_GUIDELINES.titleMax} characters. ({seoTitleLen}/{CMS_LIMITS.seoTitle})</span>
              </div>
              <div className="space-y-1">
                <input value={seoDescription} onChange={(event) => { setSeoDescription(event.target.value); setIsDirty(true); }} placeholder="Search description (optional)" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <span className="block text-[11px] text-gray-500">Recommended {CMS_SEO_GUIDELINES.descriptionMin}-{CMS_SEO_GUIDELINES.descriptionMax} characters. ({seoDescriptionLen}/{CMS_LIMITS.seoDescription})</span>
              </div>
              <div className="md:col-span-2">
                <SeoSnippetPreview title={previewTitle} description={previewDescription} url={previewUrl} />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSeoTitle((prev) => prev.trim() || title.trim().slice(0, CMS_LIMITS.seoTitle));
                    setIsDirty(true);
                  }}
                  className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Use Page Title
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSeoDescription((prev) => prev.trim() || excerpt.trim().slice(0, CMS_LIMITS.seoDescription));
                    setIsDirty(true);
                  }}
                  className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Use Summary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTwitterImageUrl((prev) => prev.trim() || ogImageUrl.trim());
                    setIsDirty(true);
                  }}
                  className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Copy Social Image to Twitter
                </button>
              </div>
              {seoAudit.topFixes.length ? (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-semibold">Top fixes to improve SEO:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {seoAudit.topFixes.map((fix) => <li key={fix}>{fix}</li>)}
                  </ul>
                </div>
              ) : null}
          {CMS_FEATURE_FLAGS.simplifiedEditorMode ? (
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvancedSeo((prev) => !prev)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                {showAdvancedSeo ? 'Hide Advanced SEO' : 'Show Advanced SEO (Optional)'}
              </button>
            </div>
          ) : null}
          {(!CMS_FEATURE_FLAGS.simplifiedEditorMode || showAdvancedSeo) ? (
            <>
              <input value={seoCanonicalUrl} onChange={(event) => { setSeoCanonicalUrl(event.target.value); setIsDirty(true); }} placeholder="Canonical URL (optional, full URL)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
              {canonicalConflictCount > 0 ? (
                <p className="text-xs text-amber-700 md:col-span-2">Canonical conflict: {canonicalConflictCount} other CMS item(s) use this canonical URL.</p>
              ) : null}
              <input value={ogTitle} onChange={(event) => { setOgTitle(event.target.value); setIsDirty(true); }} placeholder="Social title (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <input value={ogDescription} onChange={(event) => { setOgDescription(event.target.value); setIsDirty(true); }} placeholder="Social description (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <input value={ogImageUrl} onChange={(event) => { setOgImageUrl(event.target.value); setIsDirty(true); }} placeholder="Social preview image URL (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <input value={twitterImageUrl} onChange={(event) => { setTwitterImageUrl(event.target.value); setIsDirty(true); }} placeholder="Twitter image URL (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <div className="flex items-center gap-4 rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoIndex} onChange={(event) => { setSeoNoIndex(event.target.checked); setIsDirty(true); }} />Disable indexing</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoFollow} onChange={(event) => { setSeoNoFollow(event.target.checked); setIsDirty(true); }} />Disable link following</label>
              </div>
              {status !== CMS_STATUS.published ? (
                <p className="text-xs text-amber-700 md:col-span-2">Draft and scheduled content is automatically kept noindex/nofollow for safety.</p>
              ) : null}
            </>
          ) : null}

          {advancedMode ? (
            <textarea
              value={contentJson}
              onChange={(event) => { setContentJson(event.target.value); setIsDirty(true); }}
              rows={12}
              placeholder='{"heroTitle":"..."}'
              className="rounded-xl border border-gray-300 px-3 py-2 font-mono text-xs md:col-span-2"
            />
          ) : (
            <div className="space-y-3 md:col-span-2">
              {contentSections.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                    {contentSections.map((sectionKey) => {
                      const isActive = sectionKey === activeSection;
                      return (
                        <button
                          key={sectionKey}
                          type="button"
                          onClick={() => setActiveSection(sectionKey)}
                          className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                            isActive
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {toSectionLabel(sectionKey)}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={addTopLevelSection}
                      className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      + Add Section
                    </button>
                  </div>
                  {activeSection && isPlainObject(contentDraft) && activeSection in contentDraft ? (
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => moveTopLevelSection(activeSection, 'up')} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Move Up</button>
                        <button type="button" onClick={() => moveTopLevelSection(activeSection, 'down')} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Move Down</button>
                        <button type="button" onClick={() => duplicateTopLevelSection(activeSection)} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Duplicate Section</button>
                      </div>
                      {renderJsonField(activeSection, contentDraft[activeSection] as JsonLike, [activeSection])}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      Select a section to edit.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                  <p>No content loaded yet.</p>
                  <button
                    type="button"
                    onClick={loadDefaultContent}
                    className="mt-2 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    {activePreset ? 'Load Default Content' : 'Load Starter Content'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Revision History (Local)</p>
          {revisionHistory.length ? (
            <div className="mt-2 space-y-2">
              {revisionHistory.map((entry, index) => (
                <div key={`${entry.savedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-xs text-gray-600">
                    <p className="font-semibold text-gray-900">{entry.title}</p>
                    <p>{new Date(entry.savedAt).toLocaleString()} · {entry.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(entry.title);
                      setExcerpt(entry.excerpt);
                      setContentJson(entry.contentJson);
                      const parsed = parseJsonObject(entry.contentJson);
                      if (parsed) setContentDraft(parsed);
                      setIsDirty(true);
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No revisions saved yet.</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void savePage(CMS_STATUS.draft)} disabled={saving} className="rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.draft ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" onClick={() => void savePage(CMS_STATUS.published)} disabled={saving || !canPublish || settingsQuery.isLoading || settingsQuery.isFetching} className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.published ? 'Publishing...' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsPages)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

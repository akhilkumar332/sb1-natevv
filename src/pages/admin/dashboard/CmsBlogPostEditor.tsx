import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_FEATURE_FLAGS, CMS_LIMITS, CMS_STATUS, getCmsPostDocId, toCmsSlug } from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsBlogCategories, useAdminCmsBlogPosts } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { runSeoAudit } from '../../../utils/seoAudit';
import { toDateValue } from '../../../utils/dateValue';

const statusOptions = Object.values(CMS_STATUS);

type EditorTab = 'content' | 'media' | 'seo' | 'settings';

export default function CmsBlogPostEditorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams<{ slug: string }>();
  const postsQuery = useAdminCmsBlogPosts();
  const categoriesQuery = useAdminCmsBlogCategories();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.draft);
  const [excerpt, setExcerpt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [contentJson, setContentJson] = useState('');
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
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [showAdvancedSeo, setShowAdvancedSeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

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

  const publishChecks = useMemo(() => {
    const critical = [
      { id: 'title', label: 'Post title is set', passed: Boolean(title.trim()) },
      { id: 'slug', label: 'Post slug is valid', passed: Boolean(toCmsSlug(slug || title)) },
      { id: 'content', label: 'Post content is present', passed: Boolean(contentJson.trim()) },
    ];
    const warnings = [
      { id: 'excerpt', label: 'Summary (excerpt) is added', passed: Boolean(excerpt.trim()) },
      { id: 'image', label: 'Cover image is added', passed: Boolean(coverImageUrl.trim()) },
      { id: 'seo-title', label: 'Search result title is in range (20-70)', passed: seoTitleLen >= 20 && seoTitleLen <= 70 },
      { id: 'seo-desc', label: 'Search description is in range (70-180)', passed: seoDescLen >= 70 && seoDescLen <= 180 },
    ];
    return { critical, warnings };
  }, [title, slug, contentJson, excerpt, coverImageUrl, seoTitleLen, seoDescLen]);

  const canPublish = publishChecks.critical.every((entry) => entry.passed);

  useEffect(() => {
    setIsDirty(false);
    setInitializedFor(null);
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
      setContentJson(existing.contentJson || '');
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

  const savePost = async (targetStatus?: (typeof statusOptions)[number]) => {
    const normalizedTitle = title.trim();
    const normalizedSlug = toCmsSlug(slug || title);
    const nextStatus = targetStatus || status;

    if (!normalizedTitle || !normalizedSlug) {
      notify.error('Post title and slug are required.');
      return;
    }

    if (nextStatus === CMS_STATUS.published && !canPublish) {
      notify.error('Please complete all required publish checklist items.');
      return;
    }

    const duplicate = rows.find((entry) => (
      entry.slug === normalizedSlug
      && entry.slug !== normalizedParamSlug
    ));
    if (duplicate) {
      notify.error('A blog post with this slug already exists. Please use a unique slug.');
      return;
    }

    if ((contentJson || '').trim().length > CMS_LIMITS.contentJson) {
      notify.error(`Post content exceeds ${CMS_LIMITS.contentJson} characters.`);
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
      const createdAt = existingData?.createdAt || now;
      const createdBy = existingData?.createdBy || user?.uid || 'admin';
      const publishedAt = nextStatus === CMS_STATUS.published
        ? (existingData?.publishedAt || now)
        : null;

      const resolvedSeoTitle = seoTitle.trim().slice(0, CMS_LIMITS.seoTitle) || normalizedTitle.slice(0, CMS_LIMITS.seoTitle);
      const resolvedSeoDescription = seoDescription.trim().slice(0, CMS_LIMITS.seoDescription)
        || excerpt.trim().slice(0, CMS_LIMITS.seoDescription)
        || null;

      const payload = {
        title: normalizedTitle.slice(0, CMS_LIMITS.title),
        slug: normalizedSlug,
        status: nextStatus,
        excerpt: excerpt.trim().slice(0, CMS_LIMITS.excerpt) || null,
        contentJson: contentJson.trim().slice(0, CMS_LIMITS.contentJson) || null,
        categorySlug: categorySlug || null,
        coverImageUrl: coverImageUrl.trim() || null,
        featured,
        seoTitle: resolvedSeoTitle,
        seoDescription: resolvedSeoDescription,
        seoCanonicalUrl: seoCanonicalUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        seoNoIndex,
        seoNoFollow,
        ogTitle: ogTitle.trim().slice(0, CMS_LIMITS.seoTitle) || null,
        ogDescription: ogDescription.trim().slice(0, CMS_LIMITS.seoDescription) || null,
        ogImageUrl: ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || coverImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        twitterImageUrl: twitterImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || ogImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || coverImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        authorName: user?.displayName || 'Admin',
        publishedAt,
        createdBy,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      };

      await setDoc(targetRef, payload, { merge: true });

      if (currentEntry?.id && currentEntry.id !== getCmsPostDocId(normalizedSlug)) {
        const canonicalRef = doc(db, COLLECTIONS.CMS_BLOG_POSTS, getCmsPostDocId(normalizedSlug));
        await setDoc(canonicalRef, payload, { merge: true });
        await deleteDoc(targetRef);
      }

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      setStatus(nextStatus);
      setIsDirty(false);
      notify.success(nextStatus === CMS_STATUS.published ? 'Post published.' : 'Draft saved.');

      const targetPath = ROUTES.portal.admin.dashboard.cmsBlogPostEditor.replace(':slug', normalizedSlug);
      if (normalizedParamSlug !== normalizedSlug) {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Blog Post Editor</h2>
            <p className="text-sm text-gray-600">Human-friendly editor with optional advanced SEO controls.</p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsBlogPosts}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Blog Posts
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['content', 'media', 'seo', 'settings'] as EditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${activeTab === tab ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'content' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Post Title</span>
              <input value={title} onChange={(event) => { setTitle(event.target.value); setIsDirty(true); if (!slug) setSlug(toCmsSlug(event.target.value)); }} placeholder="Write a clear title" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <span className={`mt-1 block text-[11px] ${titleLen > CMS_LIMITS.title ? 'text-red-700' : 'text-gray-500'}`}>{titleLen}/{CMS_LIMITS.title}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Post Slug</span>
              <input value={slug} onChange={(event) => { setSlug(toCmsSlug(event.target.value)); setIsDirty(true); }} placeholder="post-slug" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Summary</span>
              <textarea value={excerpt} onChange={(event) => { setExcerpt(event.target.value); setIsDirty(true); }} rows={3} placeholder="Short summary shown in blog list and search" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              <span className={`mt-1 block text-[11px] ${excerptLen > CMS_LIMITS.excerpt ? 'text-red-700' : 'text-gray-500'}`}>{excerptLen}/{CMS_LIMITS.excerpt}</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Article Content</span>
              <textarea value={contentJson} onChange={(event) => { setContentJson(event.target.value); setIsDirty(true); }} rows={10} placeholder="Write your article content here..." className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}

        {activeTab === 'media' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Cover Image URL</span>
              <input value={coverImageUrl} onChange={(event) => { setCoverImageUrl(event.target.value); setIsDirty(true); }} placeholder="https://..." className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={featured} onChange={(event) => { setFeatured(event.target.checked); setIsDirty(true); }} />
              Mark as featured post
            </label>
          </div>
        ) : null}

        {activeTab === 'seo' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
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
              <p className="mt-2 text-xs text-gray-600">SEO quality score: {seoAudit.score}/100</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Search Result Title</span>
                <input value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); setIsDirty(true); }} placeholder="Defaults to post title" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <span className={`mt-1 block text-[11px] ${seoTitleLen > CMS_LIMITS.seoTitle ? 'text-red-700' : 'text-gray-500'}`}>{seoTitleLen}/{CMS_LIMITS.seoTitle}</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Search Result Description</span>
                <input value={seoDescription} onChange={(event) => { setSeoDescription(event.target.value); setIsDirty(true); }} placeholder="Defaults to summary" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <span className={`mt-1 block text-[11px] ${seoDescLen > CMS_LIMITS.seoDescription ? 'text-red-700' : 'text-gray-500'}`}>{seoDescLen}/{CMS_LIMITS.seoDescription}</span>
              </label>
            </div>

            {CMS_FEATURE_FLAGS.simplifiedEditorMode ? (
              <button
                type="button"
                onClick={() => setShowAdvancedSeo((prev) => !prev)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                {showAdvancedSeo ? 'Hide Advanced SEO' : 'Show Advanced SEO (Optional)'}
              </button>
            ) : null}

            {(!CMS_FEATURE_FLAGS.simplifiedEditorMode || showAdvancedSeo) ? (
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
                <input value={seoCanonicalUrl} onChange={(event) => { setSeoCanonicalUrl(event.target.value); setIsDirty(true); }} placeholder="Preferred URL (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
                <input value={ogTitle} onChange={(event) => { setOgTitle(event.target.value); setIsDirty(true); }} placeholder="Social title (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <input value={ogDescription} onChange={(event) => { setOgDescription(event.target.value); setIsDirty(true); }} placeholder="Social description (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <input value={ogImageUrl} onChange={(event) => { setOgImageUrl(event.target.value); setIsDirty(true); }} placeholder="Social image URL (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <input value={twitterImageUrl} onChange={(event) => { setTwitterImageUrl(event.target.value); setIsDirty(true); }} placeholder="Twitter image URL (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <div className="flex items-center gap-4 rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoIndex} onChange={(event) => { setSeoNoIndex(event.target.checked); setIsDirty(true); }} />Disable indexing</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={seoNoFollow} onChange={(event) => { setSeoNoFollow(event.target.checked); setIsDirty(true); }} />Disable link following</label>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Category</span>
              <select value={categorySlug} onChange={(event) => { setCategorySlug(event.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm">
                <option value="">No category</option>
                {categoryOptions.map((entry) => <option key={entry.id} value={entry.slug}>{entry.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Status</span>
              <select value={status} onChange={(event) => { setStatus(event.target.value as (typeof statusOptions)[number]); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm">
                {statusOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void savePost(CMS_STATUS.draft)} disabled={saving} className="rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.draft ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" onClick={() => void savePost(CMS_STATUS.published)} disabled={saving || !canPublish} className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && status === CMS_STATUS.published ? 'Publishing...' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsBlogPosts)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

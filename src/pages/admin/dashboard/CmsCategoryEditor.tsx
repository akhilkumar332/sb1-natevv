import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_LIMITS, CMS_STATUS, getCmsCategoryDocId, toCmsSlug } from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsBlogCategories } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';

const statusOptions = Object.values(CMS_STATUS);

export default function CmsCategoryEditorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams<{ slug: string }>();
  const categoriesQuery = useAdminCmsBlogCategories();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.published);
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#dc2626');
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const rows = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);
  const normalizedParamSlug = toCmsSlug(slugParam || '');
  const isNewCategory = normalizedParamSlug === 'new' || !normalizedParamSlug;

  useEffect(() => {
    if (!slugParam) return;
    if (initializedFor === slugParam) return;
    if (!isNewCategory && (categoriesQuery.isLoading || categoriesQuery.isFetching)) return;

    if (isNewCategory) {
      setName('');
      setSlug('');
      setStatus(CMS_STATUS.published);
      setDescription('');
      setColorHex('#dc2626');
      setInitializedFor(slugParam);
      return;
    }

    const existing = rows.find((entry) => entry.slug === normalizedParamSlug);
    if (existing) {
      setName(existing.name || normalizedParamSlug);
      setSlug(existing.slug || normalizedParamSlug);
      setStatus(existing.status || CMS_STATUS.published);
      setDescription(existing.description || '');
      setColorHex(existing.colorHex || '#dc2626');
    } else {
      setName(normalizedParamSlug);
      setSlug(normalizedParamSlug);
      setStatus(CMS_STATUS.published);
      setDescription('');
      setColorHex('#dc2626');
    }
    setInitializedFor(slugParam);
  }, [categoriesQuery.isLoading, initializedFor, isNewCategory, normalizedParamSlug, rows, slugParam]);

  const saveCategory = async () => {
    const normalizedName = name.trim();
    const normalizedSlug = toCmsSlug(slug || name);
    if (!normalizedName || !normalizedSlug) {
      notify.error('Category name and slug are required.');
      return;
    }

    const duplicate = rows.find((entry) => (
      entry.slug === normalizedSlug
      && entry.slug !== normalizedParamSlug
    ));
    if (duplicate) {
      notify.error('A category with this slug already exists. Please use a unique slug.');
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      const currentEntry = rows.find((entry) => entry.slug === normalizedParamSlug);
      const targetRef = doc(
        db,
        COLLECTIONS.CMS_BLOG_CATEGORIES,
        currentEntry?.id || getCmsCategoryDocId(normalizedSlug)
      );
      const existing = await getDoc(targetRef);
      const existingData = existing.exists() ? existing.data() : null;
      const createdAt = existingData?.createdAt || now;
      const createdBy = existingData?.createdBy || user?.uid || 'admin';
      await setDoc(targetRef, {
        name: normalizedName.slice(0, CMS_LIMITS.title),
        slug: normalizedSlug,
        description: description.trim().slice(0, CMS_LIMITS.excerpt) || null,
        colorHex: colorHex.trim() || null,
        status,
        createdBy,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      }, { merge: true });

      if (currentEntry?.id && currentEntry.id !== getCmsCategoryDocId(normalizedSlug)) {
        const canonicalRef = doc(db, COLLECTIONS.CMS_BLOG_CATEGORIES, getCmsCategoryDocId(normalizedSlug));
        await setDoc(canonicalRef, {
          name: normalizedName.slice(0, CMS_LIMITS.title),
          slug: normalizedSlug,
          description: description.trim().slice(0, CMS_LIMITS.excerpt) || null,
          colorHex: colorHex.trim() || null,
          status,
          createdBy,
          updatedBy: user?.uid || 'admin',
          createdAt,
          updatedAt: now,
        }, { merge: true });
        await deleteDoc(targetRef);
      }

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success('Category saved.');

      const targetPath = ROUTES.portal.admin.dashboard.cmsCategoryEditor.replace(':slug', normalizedSlug);
      if (normalizedParamSlug !== normalizedSlug) {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Category Editor</h2>
            <p className="text-sm text-gray-600">Edit category details in simple, human-friendly fields.</p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsCategories}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Categories
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(toCmsSlug(event.target.value)); }} placeholder="Category name" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <input value={slug} onChange={(event) => setSlug(toCmsSlug(event.target.value))} placeholder="category-slug" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <div className="flex items-center gap-2">
          <input value={colorHex} onChange={(event) => setColorHex(event.target.value)} placeholder="#dc2626" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
            {statusOptions.map((entry) => <option key={entry} value={entry}>{toHumanCmsStatus(entry)}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button type="button" onClick={() => void saveCategory()} disabled={saving} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Category'}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsCategories)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../constants/firestore';
import { CMS_FRONTEND_PAGE_PRESETS, CMS_PAGE_KIND, CMS_STATUS, getCmsPageDocId, type CmsFrontendPageSlug } from '../../constants/cms';
import { getServerTimestamp } from '../../utils/firestore.utils';
import { notify } from '../../services/notify.service';
import { useAuth } from '../../contexts/AuthContext';

const MAX_CUSTOM_SECTIONS = 24;
const SAFE_ACCENTS = ['red', 'blue', 'emerald', 'amber'] as const;
const SAFE_SURFACES = ['light', 'soft', 'contrast'] as const;

const isAdminRole = (role?: string | null) => role === 'admin' || role === 'superadmin';
const CMS_PREVIEW_EVENT = 'cms:preview:update';
const CMS_PREVIEW_CLEAR_EVENT = 'cms:preview:clear';

type CmsCustomSection = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  enabled: boolean;
  order: number;
};

const toEditableObject = (content: unknown): Record<string, unknown> => {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
  }
  return {};
};

const parseCustomSections = (value: unknown): CmsCustomSection[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Boolean(entry && typeof entry === 'object'))
    .map((entry, index) => {
      const item = entry as Record<string, unknown>;
      return {
        id: typeof item.id === 'string' ? item.id : `section-${index + 1}`,
        title: typeof item.title === 'string' ? item.title : '',
        body: typeof item.body === 'string' ? item.body : '',
        ctaLabel: typeof item.ctaLabel === 'string' ? item.ctaLabel : '',
        ctaHref: typeof item.ctaHref === 'string' ? item.ctaHref : '',
        enabled: item.enabled !== false,
        order: Number.isFinite(item.order) ? Number(item.order) : index + 1,
      };
    })
    .sort((a, b) => a.order - b.order);
};

const sanitizeHref = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return '';
};

export default function CmsVisualEditor({
  slug,
  content,
  pageTitle,
}: {
  slug: CmsFrontendPageSlug;
  content: unknown;
  pageTitle?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const isAllowed = isAdminRole(user?.role);
  const isEditMode = isAllowed && new URLSearchParams(location.search).get('edit') === '1';

  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'sections' | 'fields' | 'theme'>('sections');
  const [draft, setDraft] = useState<Record<string, unknown>>(() => toEditableObject(content));
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  const customSections = useMemo(
    () => parseCustomSections(draft.customSections),
    [draft.customSections]
  );
  const themeRecord = useMemo(
    () => (draft.theme && typeof draft.theme === 'object' && !Array.isArray(draft.theme)
      ? draft.theme as Record<string, unknown>
      : {}),
    [draft.theme]
  );

  const editablePrimitiveKeys = useMemo(
    () => Object.entries(draft)
      .filter(([key, value]) => key !== 'customSections' && key !== 'theme' && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
      .slice(0, 20),
    [draft]
  );

  useEffect(() => {
    if (hasLocalEdits) return;
    const next = toEditableObject(content);
    setDraft(next);
  }, [content, hasLocalEdits]);

  if (!isEditMode) {
    if (!isAllowed) return null;
    const params = new URLSearchParams(location.search);
    const enterEditMode = () => {
      params.set('edit', '1');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    };
    return (
      <button
        type="button"
        onClick={enterEditMode}
        className="fixed right-3 top-20 z-[100] rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-lg"
      >
        Edit Page
      </button>
    );
  }

  const syncDraftJson = (next: Record<string, unknown>) => {
    setHasLocalEdits(true);
    setDraft(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CMS_PREVIEW_EVENT, { detail: { slug, content: next } }));
    }
  };

  const updatePrimitive = (key: string, value: string | number | boolean) => {
    syncDraftJson({ ...draft, [key]: value });
  };

  const updateSection = (id: string, patch: Partial<CmsCustomSection>) => {
    const next = customSections.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    syncDraftJson({ ...draft, customSections: next });
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    const index = customSections.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= customSections.length) return;
    const next = [...customSections];
    const [current] = next.splice(index, 1);
    next.splice(nextIndex, 0, current);
    syncDraftJson({
      ...draft,
      customSections: next.map((entry, idx) => ({ ...entry, order: idx + 1 })),
    });
  };

  const removeSection = (id: string) => {
    syncDraftJson({
      ...draft,
      customSections: customSections
        .filter((entry) => entry.id !== id)
        .map((entry, index) => ({ ...entry, order: index + 1 })),
    });
  };

  const addSection = () => {
    if (customSections.length >= MAX_CUSTOM_SECTIONS) {
      notify.error(`Maximum ${MAX_CUSTOM_SECTIONS} sections allowed.`);
      return;
    }
    const next = [
      ...customSections,
      {
        id: `section-${Date.now()}`,
        title: 'New Section Title',
        body: 'Describe this section in one short paragraph.',
        ctaLabel: 'Learn More',
        ctaHref: '',
        enabled: true,
        order: customSections.length + 1,
      },
    ];
    syncDraftJson({ ...draft, customSections: next });
  };

  const addSectionTemplate = (template: 'text' | 'cta' | 'faq' | 'stats' | 'testimonial' | 'timeline') => {
    if (customSections.length >= MAX_CUSTOM_SECTIONS) {
      notify.error(`Maximum ${MAX_CUSTOM_SECTIONS} sections allowed.`);
      return;
    }
    const nowId = `section-${Date.now()}`;
    const entry: CmsCustomSection = template === 'cta'
      ? {
        id: nowId,
        title: 'Call to Action',
        body: 'Add a short, persuasive line.',
        ctaLabel: 'Get Started',
        ctaHref: '/portal-picker',
        enabled: true,
        order: customSections.length + 1,
      }
      : template === 'faq'
        ? {
          id: nowId,
          title: 'Frequently Asked Question',
          body: 'Answer goes here.',
          ctaLabel: '',
          ctaHref: '',
          enabled: true,
          order: customSections.length + 1,
        }
        : template === 'stats'
          ? {
            id: nowId,
            title: 'Impact Snapshot',
            body: 'Add key metrics, for example: 10,000+ donors registered.',
            ctaLabel: '',
            ctaHref: '',
            enabled: true,
            order: customSections.length + 1,
          }
          : template === 'testimonial'
            ? {
              id: nowId,
              title: 'Testimonial',
              body: '"BloodHub helped us get a donor in under an hour."',
              ctaLabel: '',
              ctaHref: '',
              enabled: true,
              order: customSections.length + 1,
            }
            : template === 'timeline'
              ? {
                id: nowId,
                title: 'Timeline',
                body: 'Step 1 -> Step 2 -> Step 3',
                ctaLabel: '',
                ctaHref: '',
                enabled: true,
                order: customSections.length + 1,
              }
        : {
          id: nowId,
          title: 'Text Section',
          body: 'Write content here.',
          ctaLabel: '',
          ctaHref: '',
          enabled: true,
          order: customSections.length + 1,
        };
    syncDraftJson({ ...draft, customSections: [...customSections, entry] });
  };

  const updateTheme = (field: 'accent' | 'surface', value: string) => {
    const current = (draft.theme && typeof draft.theme === 'object' && !Array.isArray(draft.theme))
      ? (draft.theme as Record<string, unknown>)
      : {};
    if (field === 'accent' && !SAFE_ACCENTS.includes(value as (typeof SAFE_ACCENTS)[number])) return;
    if (field === 'surface' && !SAFE_SURFACES.includes(value as (typeof SAFE_SURFACES)[number])) return;
    syncDraftJson({
      ...draft,
      theme: { ...current, [field]: value },
    });
  };

  const persist = async (mode: 'save' | 'publish') => {
    setSaving(true);
    try {
      const payload = draft;

      const safeSections = parseCustomSections((payload as Record<string, unknown>).customSections)
        .map((entry, index) => ({
          ...entry,
          order: index + 1,
          ctaHref: sanitizeHref(entry.ctaHref),
        }));
      const normalizedPayload: Record<string, unknown> = {
        ...payload,
        customSections: safeSections,
      };

      const pageDocId = getCmsPageDocId(slug);
      const pageRef = doc(db, COLLECTIONS.CMS_PAGES, pageDocId);
      const existing = await getDoc(pageRef);
      const now = getServerTimestamp();
      const preset = CMS_FRONTEND_PAGE_PRESETS.find((entry) => entry.slug === slug);
      const existingData = existing.exists() ? existing.data() : null;
      const title = pageTitle || (preset?.label || slug);
      const status = mode === 'publish'
        ? CMS_STATUS.published
        : ((typeof existingData?.status === 'string' ? existingData.status : CMS_STATUS.draft) as string);

      await setDoc(pageRef, {
        slug,
        title,
        kind: preset?.kind || CMS_PAGE_KIND.generic,
        status,
        contentJson: JSON.stringify(normalizedPayload, null, 2),
        publishedAt: status === CMS_STATUS.published ? (existingData?.publishedAt || now) : null,
        createdBy: existingData?.createdBy || user?.uid || 'admin',
        updatedBy: user?.uid || 'admin',
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
      }, { merge: true });

      await queryClient.invalidateQueries({ queryKey: ['cms'] });
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      setDraft(normalizedPayload);
      setHasLocalEdits(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CMS_PREVIEW_EVENT, { detail: { slug, content: normalizedPayload } }));
      }
      notify.success(mode === 'publish' ? 'Page published from visual editor.' : 'Page changes saved.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save visual editor changes.');
    } finally {
      setSaving(false);
    }
  };

  const exitEditMode = () => {
    setHasLocalEdits(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CMS_PREVIEW_CLEAR_EVENT, { detail: { slug } }));
    }
    const params = new URLSearchParams(location.search);
    params.delete('edit');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  return (
    <aside className="fixed right-3 top-20 z-[100] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-red-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-red-100 px-3 py-2">
        <p className="text-sm font-bold text-gray-900">Visual Editor</p>
        <button type="button" onClick={() => setOpen((prev) => !prev)} className="rounded border border-gray-300 px-2 py-1 text-xs">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open ? (
        <div className="max-h-[75vh] space-y-3 overflow-auto p-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void persist('save')} disabled={saving} className="rounded-md border border-red-600 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Save Draft</button>
            <button type="button" onClick={() => void persist('publish')} disabled={saving} className="rounded-md border border-emerald-600 bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Publish Live</button>
            <button type="button" onClick={exitEditMode} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700">Exit</button>
          </div>
          <p className="text-[11px] text-gray-500">Tip: Edits preview instantly on page. Publish Live updates public content.</p>

          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button type="button" onClick={() => setActiveTab('sections')} className={`rounded-md px-2 py-1 text-xs font-semibold ${activeTab === 'sections' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600'}`}>Sections</button>
            <button type="button" onClick={() => setActiveTab('fields')} className={`rounded-md px-2 py-1 text-xs font-semibold ${activeTab === 'fields' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600'}`}>Page Text</button>
            <button type="button" onClick={() => setActiveTab('theme')} className={`rounded-md px-2 py-1 text-xs font-semibold ${activeTab === 'theme' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600'}`}>Theme</button>
          </div>

          {activeTab === 'theme' ? (
            <div className="rounded-xl border border-gray-200 p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Theme Tokens</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={typeof themeRecord.accent === 'string' ? themeRecord.accent : 'red'}
                onChange={(event) => updateTheme('accent', event.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs"
              >
                {SAFE_ACCENTS.map((token) => <option key={token} value={token}>{token}</option>)}
              </select>
              <select
                value={typeof themeRecord.surface === 'string' ? themeRecord.surface : 'light'}
                onChange={(event) => updateTheme('surface', event.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs"
              >
                {SAFE_SURFACES.map((token) => <option key={token} value={token}>{token}</option>)}
              </select>
            </div>
            </div>
          ) : null}

          {activeTab === 'sections' ? (
            <div className="rounded-xl border border-gray-200 p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Custom Sections</p>
              <button type="button" onClick={addSection} className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">+ Add</button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => addSectionTemplate('text')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ Text</button>
              <button type="button" onClick={() => addSectionTemplate('cta')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ CTA</button>
              <button type="button" onClick={() => addSectionTemplate('faq')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ FAQ</button>
              <button type="button" onClick={() => addSectionTemplate('stats')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ Stats</button>
              <button type="button" onClick={() => addSectionTemplate('testimonial')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ Testimonial</button>
              <button type="button" onClick={() => addSectionTemplate('timeline')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700">+ Timeline</button>
            </div>
            <div className="space-y-2">
              {customSections.map((section, index) => (
                <div key={section.id} className="rounded-lg border border-gray-100 p-2">
                  <input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} placeholder="Section title" className="mb-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                  <textarea value={section.body} onChange={(event) => updateSection(section.id, { body: event.target.value })} rows={2} placeholder="Section body" className="mb-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                  <div className="grid grid-cols-2 gap-1">
                    <input value={section.ctaLabel} onChange={(event) => updateSection(section.id, { ctaLabel: event.target.value })} placeholder="CTA label" className="rounded border border-gray-300 px-2 py-1.5 text-xs" />
                    <input value={section.ctaHref} onChange={(event) => updateSection(section.id, { ctaHref: event.target.value })} placeholder="CTA href" className="rounded border border-gray-300 px-2 py-1.5 text-xs" />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <label className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={section.enabled} onChange={(event) => updateSection(section.id, { enabled: event.target.checked })} />
                      enabled
                    </label>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === customSections.length - 1} className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] disabled:opacity-50">↓</button>
                      <button type="button" onClick={() => removeSection(section.id)} className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-700">Del</button>
                    </div>
                  </div>
                </div>
              ))}
              {customSections.length === 0 ? <p className="text-xs text-gray-500">No custom sections yet.</p> : null}
            </div>
            </div>
          ) : null}

          {activeTab === 'fields' ? (
            <div className="rounded-xl border border-gray-200 p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Core Fields</p>
            </div>
            <div className="space-y-1.5">
              {editablePrimitiveKeys.map(([key, value]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-600">{key}</span>
                  {typeof value === 'boolean' ? (
                    <input type="checkbox" checked={value} onChange={(event) => updatePrimitive(key, event.target.checked)} />
                  ) : (
                    <input
                      value={String(value)}
                      onChange={(event) => updatePrimitive(key, typeof value === 'number' ? Number(event.target.value || 0) : event.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  )}
                </label>
              ))}
            </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

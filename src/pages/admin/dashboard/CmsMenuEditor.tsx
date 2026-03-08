import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_LIMITS, CMS_MENU_LOCATION, getCmsMenuDocId } from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsNavMenus } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { toDateValue } from '../../../utils/dateValue';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';

type MenuStatus = 'published' | 'draft';

const locationOptions = Object.values(CMS_MENU_LOCATION);

type MenuItemInput = {
  id: string;
  label: string;
  path: string;
  external: boolean;
  order: number;
  enabled: boolean;
};

const isValidLocation = (value: string): value is (typeof locationOptions)[number] => (
  locationOptions.includes(value as (typeof locationOptions)[number])
);

const normalizeMenuItemsPayload = (value: unknown) => {
  if (!Array.isArray(value)) throw new Error('Menu items must be an array.');
  if (value.length > CMS_LIMITS.menuItemsPerMenu) {
    throw new Error(`Menu supports up to ${CMS_LIMITS.menuItemsPerMenu} items.`);
  }

  const hasUnsafeScheme = (path: string): boolean => /^(javascript|data|vbscript):/i.test(path);
  const isExternalPath = (path: string): boolean => /^(https?:\/\/|mailto:|tel:)/i.test(path);
  const isValidInternalPath = (path: string): boolean => /^\/\S*$/.test(path);

  const normalized = value.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new Error(`Menu item #${index + 1} must be an object.`);
    }

    const item = rawItem as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const path = typeof item.path === 'string' ? item.path.trim() : '';
    const external = item.external === true || isExternalPath(path);
    const order = Number.isFinite(item.order) ? Number(item.order) : index + 1;
    const enabled = item.enabled !== false;

    if (!id || !label || !path) {
      throw new Error(`Menu item #${index + 1} requires id, label, and path.`);
    }
    if (hasUnsafeScheme(path)) {
      throw new Error(`Menu item #${index + 1} has an unsafe URL scheme.`);
    }
    if (external) {
      if (!isExternalPath(path)) throw new Error(`Menu item #${index + 1} must use https/mailto/tel for external links.`);
    } else if (!isValidInternalPath(path)) {
      throw new Error(`Menu item #${index + 1} must use an internal path starting with "/".`);
    }

    return { id, label, path, external, order, enabled };
  });

  const seenIds = new Set<string>();
  normalized.forEach((item, index) => {
    if (seenIds.has(item.id)) {
      throw new Error(`Menu item #${index + 1} uses duplicate id "${item.id}". IDs must be unique.`);
    }
    seenIds.add(item.id);
  });

  return normalized;
};

export default function CmsMenuEditorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { location: locationParam } = useParams<{ location: string }>();
  const menusQuery = useAdminCmsNavMenus();

  const initialLocation = isValidLocation(locationParam || '')
    ? (locationParam as (typeof locationOptions)[number])
    : CMS_MENU_LOCATION.header;

  const [location, setLocation] = useState<(typeof locationOptions)[number]>(initialLocation);
  const [status, setStatus] = useState<MenuStatus>('published');
  const [items, setItems] = useState<MenuItemInput[]>([{ id: 'home', label: 'Home', path: '/', external: false, order: 1, enabled: true }]);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hydratedRevisionKey, setHydratedRevisionKey] = useState<string | null>(null);

  const rows = useMemo(() => menusQuery.data || [], [menusQuery.data]);

  useEffect(() => {
    if (!isValidLocation(locationParam || '')) return;
    const nextLocation = locationParam as (typeof locationOptions)[number];
    const existing = rows.find((entry) => entry.location === nextLocation);
    const updatedAt = toDateValue(existing?.updatedAt);
    const revisionKey = `${nextLocation}:${existing?.id || 'none'}:${updatedAt?.getTime() ?? 'no-updated-at'}`;
    if (isDirty) return;
    if (hydratedRevisionKey === revisionKey) return;

    setLocation(nextLocation);
    if (existing) {
      const nextItems = Array.isArray(existing.items) && existing.items.length > 0
        ? existing.items.map((entry, index) => ({
          id: entry.id || `item-${index + 1}`,
          label: entry.label || '',
          path: entry.path || '/',
          external: entry.external === true,
          order: Number.isFinite(entry.order) ? Number(entry.order) : index + 1,
          enabled: entry.enabled !== false,
        }))
        : [{ id: 'home', label: 'Home', path: '/', external: false, order: 1, enabled: true }];
      setStatus(existing.status === 'draft' ? 'draft' : 'published');
      setItems(nextItems);
    } else {
      const fallback = [{ id: 'home', label: 'Home', path: '/', external: false, order: 1, enabled: true }];
      setStatus('published');
      setItems(fallback);
    }
    setHydratedRevisionKey(revisionKey);
  }, [hydratedRevisionKey, isDirty, locationParam, rows]);

  const updateItem = (index: number, patch: Partial<MenuItemInput>) => {
    setIsDirty(true);
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch, order: index + 1 };
      return next;
    });
  };

  const addItem = () => {
    setIsDirty(true);
    setItems((prev) => {
      return [...prev, { id: `item-${prev.length + 1}`, label: '', path: '/', external: false, order: prev.length + 1, enabled: true }];
    });
  };

  const removeItem = (index: number) => {
    setIsDirty(true);
    setItems((prev) => {
      return prev.filter((_, idx) => idx !== index).map((entry, idx) => ({ ...entry, order: idx + 1 }));
    });
  };

  const saveMenu = async () => {
    let parsed: Array<{ id: string; label: string; path: string; external: boolean; order: number; enabled: boolean }> = [];
    try {
      parsed = normalizeMenuItemsPayload(items);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Invalid menu items.');
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      const ref = doc(db, COLLECTIONS.CMS_NAV_MENUS, getCmsMenuDocId(location));
      const existing = await getDoc(ref);
      const createdAt = existing.exists() ? (existing.data()?.createdAt || now) : now;
      await setDoc(ref, {
        location,
        status,
        items: parsed,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      }, { merge: true });

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      setItems(parsed.map((entry, index) => ({ ...entry, order: index + 1 })));
      setIsDirty(false);
      setHydratedRevisionKey(null);
      notify.success('Menu saved.');

      const targetPath = ROUTES.portal.admin.dashboard.cmsMenuEditor.replace(':location', location);
      if (locationParam !== location) {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save menu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Menu Editor</h2>
            <p className="text-sm text-gray-600">Edit navigation using simple labels and destinations.</p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsMenus}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Menus
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={location}
            onChange={(event) => {
              const nextLocation = event.target.value as (typeof locationOptions)[number];
              setLocation(nextLocation);
              setIsDirty(false);
              setHydratedRevisionKey(null);
              navigate(ROUTES.portal.admin.dashboard.cmsMenuEditor.replace(':location', nextLocation));
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            {locationOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as MenuStatus); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
            <option value="published">{toHumanCmsStatus('published')}</option>
            <option value="draft">{toHumanCmsStatus('draft')}</option>
          </select>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Menu Items</p>
            <button type="button" onClick={addItem} className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">+ Add Item</button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item.id}-${index}`} className="grid gap-2 rounded-lg border border-gray-200 bg-white p-2 md:grid-cols-6">
                <input value={item.id} onChange={(event) => updateItem(index, { id: event.target.value })} placeholder="id" className="rounded border border-gray-300 px-2 py-1.5 text-xs md:col-span-1" />
                <input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} placeholder="Label" className="rounded border border-gray-300 px-2 py-1.5 text-xs md:col-span-2" />
                <input value={item.path} onChange={(event) => updateItem(index, { path: event.target.value })} placeholder="/path or https://..." className="rounded border border-gray-300 px-2 py-1.5 text-xs md:col-span-2" />
                <div className="flex items-center justify-end gap-2 md:col-span-1">
                  <label className="inline-flex items-center gap-1 text-[11px] text-gray-600"><input type="checkbox" checked={item.external} onChange={(event) => updateItem(index, { external: event.target.checked })} />external</label>
                  <label className="inline-flex items-center gap-1 text-[11px] text-gray-600"><input type="checkbox" checked={item.enabled} onChange={(event) => updateItem(index, { enabled: event.target.checked })} />enabled</label>
                  <button type="button" onClick={() => removeItem(index)} className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-700 hover:bg-red-50">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => void saveMenu()} disabled={saving} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Menu'}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsMenus)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

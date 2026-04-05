import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe2, Languages, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { bundledLocaleDictionaries, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, getLanguageNativeLabel, type SupportedLanguage } from '../../../locales';
import { useAdminCmsBlogPosts, useAdminCmsPages, useAdminTranslationOverrides } from '../../../hooks/admin/useAdminQueries';
import {
  buildCmsLocaleCoverageSummaries,
  buildTranslationLanguageSummaries,
  buildTranslationLeafRows,
  buildTranslationNamespaceSummary,
  flattenTranslationObject,
  unflattenTranslationObject,
} from '../../../utils/translationCatalog';
import type { TranslationOverrideMap } from '../../../types/database.types';
import { saveTranslationOverrideBundle } from '../../../services/translationOverrides.service';
import { applyTranslationOverrideBundles } from '../../../services/translationRuntime.service';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { notify } from '../../../services/notify.service';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import AdminPagination from '../../../components/admin/AdminPagination';
import { AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { refetchQueries } from '../../../utils/queryRefetch';
import { toDateValue } from '../../../utils/dateValue';

type RowFilter = 'all' | 'missing' | 'same' | 'overridden';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatDateTime = (value: unknown) => {
  const date = toDateValue(value);
  if (!date) return 'Never';
  return date.toLocaleString();
};

const getOverrideMapByLanguage = (documents: ReturnType<typeof useAdminTranslationOverrides>['data']) => {
  return (documents || []).reduce<Partial<Record<SupportedLanguage, TranslationOverrideMap>>>((acc, entry) => {
    if (SUPPORTED_LANGUAGES.includes(entry.language as SupportedLanguage)) {
      acc[entry.language as SupportedLanguage] = entry.translations;
    }
    return acc;
  }, {});
};

function AdminTranslationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overridesQuery = useAdminTranslationOverrides();
  const cmsPagesQuery = useAdminCmsPages();
  const blogPostsQuery = useAdminCmsBlogPosts();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('hi');
  const [rowFilter, setRowFilter] = useState<RowFilter>('missing');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [draftEdits, setDraftEdits] = useState<Partial<Record<SupportedLanguage, Record<string, string>>>>({});
  const [saving, setSaving] = useState(false);

  const overrideMapByLanguage = useMemo(
    () => getOverrideMapByLanguage(overridesQuery.data),
    [overridesQuery.data],
  );

  const bundledFlatByLanguage = useMemo(() => (
    Object.fromEntries(
      SUPPORTED_LANGUAGES.map((language) => [language, flattenTranslationObject(bundledLocaleDictionaries[language])]),
    ) as Record<SupportedLanguage, Record<string, string>>
  ), []);

  const baseRows = useMemo(
    () => buildTranslationLeafRows(overrideMapByLanguage),
    [overrideMapByLanguage],
  );

  const effectiveRows = useMemo(() => {
    return baseRows.map((row) => {
      const values = { ...row.values };
      SUPPORTED_LANGUAGES.forEach((language) => {
        const draft = draftEdits[language]?.[row.key];
        if (typeof draft === 'string') values[language] = draft;
      });
      return { ...row, values };
    });
  }, [baseRows, draftEdits]);

  const languageSummaries = useMemo(
    () => buildTranslationLanguageSummaries(effectiveRows),
    [effectiveRows],
  );
  const namespaceSummaries = useMemo(
    () => buildTranslationNamespaceSummary(effectiveRows, selectedLanguage),
    [effectiveRows, selectedLanguage],
  );
  const cmsCoverage = useMemo(
    () => buildCmsLocaleCoverageSummaries(cmsPagesQuery.data || [], blogPostsQuery.data || []),
    [blogPostsQuery.data, cmsPagesQuery.data],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return effectiveRows.filter((row) => {
      const localized = row.values[selectedLanguage].trim();
      const english = row.english.trim();
      const hasOverride = typeof draftEdits[selectedLanguage]?.[row.key] === 'string'
        || Boolean(flattenTranslationObject(overrideMapByLanguage[selectedLanguage] || {})[row.key]);

      const filterMatch = rowFilter === 'all'
        || (rowFilter === 'missing' && !localized)
        || (rowFilter === 'same' && localized.length > 0 && localized === english)
        || (rowFilter === 'overridden' && hasOverride);

      if (!filterMatch) return false;
      if (!normalizedSearch) return true;
      return (
        row.key.toLowerCase().includes(normalizedSearch)
        || row.namespace.toLowerCase().includes(normalizedSearch)
        || english.toLowerCase().includes(normalizedSearch)
        || SUPPORTED_LANGUAGES.some((language) => row.values[language].toLowerCase().includes(normalizedSearch))
      );
    });
  }, [draftEdits, effectiveRows, overrideMapByLanguage, rowFilter, searchTerm, selectedLanguage]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const latestUpdatedAt = useMemo(() => {
    const timestamps = (overridesQuery.data || [])
      .map((entry) => toDateValue(entry.updatedAt)?.getTime() ?? 0)
      .filter((value) => value > 0);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
  }, [overridesQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, rowFilter, searchTerm, selectedLanguage]);

  const updateDraftValue = (language: SupportedLanguage, key: string, value: string) => {
    setDraftEdits((prev) => ({
      ...prev,
      [language]: {
        ...(prev[language] || {}),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextBundles = SUPPORTED_LANGUAGES.reduce<Partial<Record<SupportedLanguage, TranslationOverrideMap>>>((acc, language) => {
        const currentFlat = effectiveRows.reduce<Record<string, string>>((map, row) => {
          map[row.key] = row.values[language];
          return map;
        }, {});
        const bundledFlat = bundledFlatByLanguage[language];
        const overridesFlat = Object.entries(currentFlat).reduce<Record<string, string>>((map, [key, value]) => {
          const normalized = value.trim();
          const bundled = bundledFlat[key] || '';
          if (!normalized || normalized === bundled) return map;
          map[key] = value;
          return map;
        }, {});
        acc[language] = unflattenTranslationObject(overridesFlat);
        return acc;
      }, {});

      await Promise.all(
        SUPPORTED_LANGUAGES.map((language) => (
          saveTranslationOverrideBundle(language, nextBundles[language] || {}, user?.uid || null)
        )),
      );

      applyTranslationOverrideBundles(nextBundles);
      await invalidateAdminRecipe(queryClient, 'translationsUpdated');
      refetchQueries(overridesQuery, cmsPagesQuery, blogPostsQuery);
      setDraftEdits({});
      notify.success('Translations saved successfully.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save translations.');
    } finally {
      setSaving(false);
    }
  };

  const selectedLanguageSummary = languageSummaries.find((entry) => entry.language === selectedLanguage);
  const cmsCoverageForLanguage = cmsCoverage.filter((entry) => entry.language === selectedLanguage);
  const hasNextPage = page * pageSize < filteredRows.length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Globe2 className="h-3.5 w-3.5" />
              Translation Control Center
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">Translations</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Manage locale-key overrides, review project-wide translation coverage, and track CMS localization progress from one admin surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminRefreshButton
              onClick={() => refetchQueries(overridesQuery, cmsPagesQuery, blogPostsQuery)}
              isRefreshing={overridesQuery.isFetching || cmsPagesQuery.isFetching || blogPostsQuery.isFetching}
              label="Refresh translations"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save overrides
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">Locale keys</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{effectiveRows.length}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Total editable key bindings loaded from bundled locale files.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">{getLanguageNativeLabel(selectedLanguage)} missing</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{selectedLanguageSummary?.missingCount || 0}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Rows still empty in the selected language.</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">{getLanguageNativeLabel(selectedLanguage)} completion</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{selectedLanguageSummary?.completionPercent.toFixed(1) || '0.0'}%</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Counts values different from English and non-empty.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Last override update</p>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{latestUpdatedAt ? latestUpdatedAt.toLocaleString() : 'Never'}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Firestore-backed translation overrides remain optional on top of bundled defaults.</p>
          </div>
        </div>
      </section>

      <AdminRefreshingBanner
        show={overridesQuery.isFetching || cmsPagesQuery.isFetching || blogPostsQuery.isFetching}
        message="Refreshing translation health and localized CMS coverage."
      />
      <AdminErrorCard
        message={(overridesQuery.error || cmsPagesQuery.error || blogPostsQuery.error) instanceof Error
          ? ((overridesQuery.error || cmsPagesQuery.error || blogPostsQuery.error) as Error).message
          : null}
        onRetry={() => refetchQueries(overridesQuery, cmsPagesQuery, blogPostsQuery)}
      />

      <section className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Project-wide translation progress</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {languageSummaries.map((summary) => (
              <article key={summary.language} className={`rounded-2xl border p-4 ${summary.language === selectedLanguage ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10' : 'border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-slate-900/60'}`}>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage(summary.language)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{getLanguageNativeLabel(summary.language)}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{summary.language.toUpperCase()}</p>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{summary.completionPercent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-700" style={{ width: `${summary.completionPercent}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-slate-300">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{summary.translatedCount}</p>
                      <p>Native</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{summary.sameAsEnglishCount}</p>
                      <p>Same as EN</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{summary.missingCount}</p>
                      <p>Missing</p>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">CMS localization coverage</h2>
          </div>
          <div className="mt-4 space-y-3">
            {cmsCoverageForLanguage.map((entry) => (
              <div key={`${entry.surface}-${entry.language}`} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-slate-900/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.surface === 'frontendPages' ? 'Frontend pages' : 'Blog posts'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {entry.localizedFieldCount} of {entry.totalFieldCount} localized fields filled
                    </p>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{entry.completionPercent.toFixed(1)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${entry.completionPercent}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Coverage is computed from localized CMS fields on the five public frontend pages and current blog posts.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Key editor</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Every locale key is listed separately with English source text and editable values for all supported languages.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search key or value"
                className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value as SupportedLanguage)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white"
            >
              {SUPPORTED_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE).map((language) => (
                <option key={language} value={language}>{getLanguageNativeLabel(language)}</option>
              ))}
            </select>
            <select
              value={rowFilter}
              onChange={(event) => setRowFilter(event.target.value as RowFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">All rows</option>
              <option value="missing">Missing</option>
              <option value="same">Same as English</option>
              <option value="overridden">Overridden</option>
            </select>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-slate-200">
              Last saved: {formatDateTime(latestUpdatedAt)}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1500px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">EN</th>
                {SUPPORTED_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE).map((language) => (
                  <th key={language} className="px-3 py-2">{language.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.key} className="align-top">
                  <td className="rounded-l-2xl border border-r-0 border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-gray-700 dark:bg-slate-900/60">
                    <p className="font-mono text-xs text-red-700 dark:text-red-300">{row.key}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{row.namespace}</p>
                  </td>
                  <td className="border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-[#0f1726]">
                    <textarea
                      value={row.values.en}
                      onChange={(event) => updateDraftValue('en', row.key, event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white"
                    />
                  </td>
                  {SUPPORTED_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE).map((language, index, array) => {
                    const localizedValue = row.values[language];
                    const sameAsEnglish = localizedValue.trim().length > 0 && localizedValue.trim() === row.values.en.trim();
                    const isMissing = !localizedValue.trim();
                    return (
                      <td
                        key={`${row.key}-${language}`}
                        className={`border bg-white px-3 py-3 dark:bg-[#0f1726] ${
                          index === array.length - 1 ? 'rounded-r-2xl' : ''
                        } ${
                          isMissing
                            ? 'border-amber-200 dark:border-amber-500/30'
                            : sameAsEnglish
                              ? 'border-blue-200 dark:border-blue-500/30'
                              : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <textarea
                          value={localizedValue}
                          onChange={(event) => updateDraftValue(language, row.key, event.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white"
                        />
                        <p className={`mt-2 text-[11px] font-semibold ${
                          isMissing
                            ? 'text-amber-700 dark:text-amber-300'
                            : sameAsEnglish
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {isMissing ? 'Missing' : sameAsEnglish ? 'Same as English' : 'Localized'}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <AdminPagination
            page={page}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemCount={filteredRows.length}
            hasNextPage={hasNextPage}
            loading={saving}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Namespace progress for {getLanguageNativeLabel(selectedLanguage)}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {namespaceSummaries.map((entry) => (
            <article key={entry.namespace} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.namespace}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{entry.translatedCount} of {entry.totalCount} fully localized</p>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{entry.completionPercent.toFixed(1)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-700" style={{ width: `${entry.completionPercent}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-600 dark:text-slate-300">
                <span>Missing: {entry.missingCount}</span>
                <span>Same as EN: {entry.sameAsEnglishCount}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminTranslationsPage;

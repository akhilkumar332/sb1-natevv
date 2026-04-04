import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Tag } from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { CMS_DEFAULTS, CMS_LIMITS, CMS_QUERY_LIMITS, CMS_RUNTIME, CMS_SEO_DEFAULTS, toCmsSlug } from '../constants/cms';
import { usePublishedBlogPosts, usePublicCmsSettings } from '../hooks/useCmsContent';
import { getPublishedBlogPostBySlug, getPublishedBlogPosts } from '../services/cms.service';
import { toDateValue } from '../utils/dateValue';
import { pickLocalizedCmsString } from '../utils/cmsLocalization';
import SeoHead from '../components/SeoHead';
import { buildBlogSchema, buildBreadcrumbSchema, buildOrganizationSchema, buildWebSiteSchema } from '../utils/seoStructuredData';

const toHumanLabel = (value: string) => value
  .split(/[-_]/g)
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getPaginationItems = (currentPage: number, totalPages: number): Array<number | 'ellipsis'> => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 2) return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
};

export default function BlogPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { categorySlug: routeCategorySlug, seriesSlug: routeSeriesSlug, authorName: routeAuthorName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingStalled, setLoadingStalled] = useState(false);
  const settingsQuery = usePublicCmsSettings();
  const postsPerPage = Math.max(
    CMS_LIMITS.blogPostsPageSizeMin,
    Math.min(CMS_LIMITS.blogPostsPageSizeMax, Number(settingsQuery.data?.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage))
  );
  const siteTitle = settingsQuery.data?.siteTitle || CMS_DEFAULTS.siteTitle;
  const seoTitle = settingsQuery.data?.defaultSeoTitle || CMS_DEFAULTS.defaultSeoTitle;
  const seoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const canonicalBase = canonicalBaseUrl.replace(/\/+$/, '');
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';
  const rawPage = Number(searchParams.get('page') || '1');
  const activePage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const initialRequestedPosts = Math.min(
    CMS_QUERY_LIMITS.publicBlogSummaryList,
    Math.max(postsPerPage * 2, activePage * postsPerPage + postsPerPage),
  );
  const [requestedPosts, setRequestedPosts] = useState(initialRequestedPosts);
  const postsQuery = usePublishedBlogPosts(requestedPosts, true);

  useEffect(() => {
    setRequestedPosts(initialRequestedPosts);
  }, [initialRequestedPosts]);

  useEffect(() => {
    if (requestedPosts >= CMS_QUERY_LIMITS.publicBlogSummaryList) return;
    if (typeof window === 'undefined') return;
    const topUp = () => {
      setRequestedPosts(CMS_QUERY_LIMITS.publicBlogSummaryList);
      void queryClient.prefetchQuery({
        queryKey: ['cms', 'public', 'blogPosts', { limitCount: CMS_QUERY_LIMITS.publicBlogSummaryList }],
        queryFn: () => getPublishedBlogPosts(CMS_QUERY_LIMITS.publicBlogSummaryList),
        staleTime: 60_000,
      });
    };
    const win = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(topUp);
      return () => {
        if (typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(idleId);
      };
    }
    const timer = window.setTimeout(topUp, Math.max(0, CMS_RUNTIME.backgroundQueueDelayMs));
    return () => window.clearTimeout(timer);
  }, [queryClient, requestedPosts]);

  const refreshAppCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } finally {
      window.location.reload();
    }
  };

  const selectedCategory = searchParams.get('category') || (routeCategorySlug || 'all');
  const selectedSeries = searchParams.get('series') || (routeSeriesSlug || 'all');
  const selectedAuthor = searchParams.get('author') || (routeAuthorName ? decodeURIComponent(routeAuthorName) : 'all');
  const selectedSort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const selectedQuery = (searchParams.get('q') || '').trim().toLowerCase();

  const posts = postsQuery.data || [];
  const blogHeading = routeCategorySlug
    ? t('blog.categoryHeading', { value: toHumanLabel(routeCategorySlug) })
    : routeSeriesSlug
      ? t('blog.seriesHeading', { value: toHumanLabel(routeSeriesSlug) })
      : routeAuthorName
        ? t('blog.authorHeading', { value: decodeURIComponent(routeAuthorName) })
        : t('blog.title');
  const prefetchPostBySlug = (postSlug: string) => {
    const normalizedSlug = toCmsSlug(postSlug);
    if (!normalizedSlug) return;
    void queryClient.prefetchQuery({
      queryKey: ['cms', 'public', 'blogPostBySlug', normalizedSlug],
      queryFn: () => getPublishedBlogPostBySlug(normalizedSlug),
      staleTime: 60_000,
    });
  };

  useEffect(() => {
    if (!postsQuery.isLoading || posts.length > 0) {
      setLoadingStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingStalled(true), CMS_RUNTIME.blogLoadingStallMs);
    return () => window.clearTimeout(timer);
  }, [posts.length, postsQuery.isLoading]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      if (post.categorySlug) set.add(post.categorySlug);
    });
    return Array.from(set).sort();
  }, [posts]);
  const series = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      if (post.seriesSlug) set.add(post.seriesSlug);
    });
    return Array.from(set).sort();
  }, [posts]);
  const authors = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      if (post.authorName) set.add(post.authorName);
    });
    return Array.from(set).sort();
  }, [posts]);

  const effectiveCategory = (
    selectedCategory === 'all' || categories.includes(selectedCategory)
      ? selectedCategory
      : 'all'
  );
  const effectiveSeries = (
    selectedSeries === 'all' || series.includes(selectedSeries)
      ? selectedSeries
      : 'all'
  );
  const effectiveAuthor = (
    selectedAuthor === 'all' || authors.includes(selectedAuthor)
      ? selectedAuthor
      : 'all'
  );

  const filteredPosts = useMemo(() => (
    posts.filter((post) => {
      const localizedTitle = pickLocalizedCmsString(i18n.resolvedLanguage, post.titleByLocale, post.title) || post.title;
      const localizedExcerpt = pickLocalizedCmsString(i18n.resolvedLanguage, post.excerptByLocale, post.excerpt) || '';
      const categoryMatch = effectiveCategory === 'all' || post.categorySlug === effectiveCategory;
      const seriesMatch = effectiveSeries === 'all' || post.seriesSlug === effectiveSeries;
      const authorMatch = effectiveAuthor === 'all' || post.authorName === effectiveAuthor;
      const searchMatch = !selectedQuery
        || localizedTitle.toLowerCase().includes(selectedQuery)
        || localizedExcerpt.toLowerCase().includes(selectedQuery)
        || (post.tags || []).some((tag) => tag.toLowerCase().includes(selectedQuery));
      return categoryMatch && seriesMatch && authorMatch && searchMatch;
    })
  ), [posts, effectiveCategory, effectiveSeries, effectiveAuthor, selectedQuery, i18n.resolvedLanguage]);
  const sortedPosts = useMemo(() => {
    const next = [...filteredPosts];
    next.sort((a, b) => {
      const aTs = toDateValue(a.publishedAt)?.getTime() || 0;
      const bTs = toDateValue(b.publishedAt)?.getTime() || 0;
      return selectedSort === 'oldest' ? aTs - bTs : bTs - aTs;
    });
    return next;
  }, [filteredPosts, selectedSort]);

  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / postsPerPage));
  const currentPage = Math.min(activePage, totalPages);
  const pageItems = useMemo(() => getPaginationItems(currentPage, totalPages), [currentPage, totalPages]);
  const pagedPosts = useMemo(() => {
    const start = (currentPage - 1) * postsPerPage;
    return sortedPosts.slice(start, start + postsPerPage);
  }, [sortedPosts, currentPage, postsPerPage]);
  const pageStartItem = sortedPosts.length === 0 ? 0 : (currentPage - 1) * postsPerPage + 1;
  const pageEndItem = sortedPosts.length === 0 ? 0 : Math.min(sortedPosts.length, currentPage * postsPerPage);
  const hasActiveFilters = Boolean(
    selectedQuery
      || effectiveCategory !== 'all'
      || effectiveSeries !== 'all'
      || effectiveAuthor !== 'all'
      || selectedSort !== 'newest'
  );
  const applyParams = (next: { category?: string; series?: string; author?: string; sort?: 'newest' | 'oldest'; q?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    if (typeof next.category !== 'undefined') {
      if (!next.category || next.category === 'all') params.delete('category');
      else params.set('category', next.category);
      params.delete('page');
    }
    if (typeof next.page !== 'undefined') {
      if (next.page <= 1) params.delete('page');
      else params.set('page', String(next.page));
    }
    if (typeof next.series !== 'undefined') {
      if (!next.series || next.series === 'all') params.delete('series');
      else params.set('series', next.series);
      params.delete('page');
    }
    if (typeof next.author !== 'undefined') {
      if (!next.author || next.author === 'all') params.delete('author');
      else params.set('author', next.author);
      params.delete('page');
    }
    if (typeof next.sort !== 'undefined') {
      if (next.sort === 'newest') params.delete('sort');
      else params.set('sort', next.sort);
      params.delete('page');
    }
    if (typeof next.q !== 'undefined') {
      if (!next.q.trim()) params.delete('q');
      else params.set('q', next.q.trim());
      params.delete('page');
    }
    setSearchParams(params);
  };

  useEffect(() => {
    if (activePage <= totalPages) return;
    const params = new URLSearchParams(searchParams);
    if (totalPages <= 1) params.delete('page');
    else params.set('page', String(totalPages));
    setSearchParams(params);
  }, [activePage, totalPages, searchParams, setSearchParams]);

  return (
    <div className="w-full public-app-page public-app-blog">
      <SeoHead
        title={`${seoTitle} | ${t('blog.title')}`}
        description={seoDescription}
        type="website"
        siteName={siteTitle}
        locale={CMS_SEO_DEFAULTS.locale}
        canonicalPath={ROUTES.blog}
        canonicalBaseUrl={canonicalBaseUrl}
        ogImageUrl={defaultOgImageUrl || undefined}
        twitterImageUrl={defaultOgImageUrl || undefined}
        twitterHandle={settingsQuery.data?.twitterHandle || undefined}
        robots={robotsPolicy}
        structuredData={[
          buildOrganizationSchema({
            baseUrl: canonicalBase || (typeof window !== 'undefined' ? window.location.origin : ''),
            siteName: siteTitle,
          }),
          buildWebSiteSchema({
            baseUrl: canonicalBase || (typeof window !== 'undefined' ? window.location.origin : ''),
            siteName: siteTitle,
            description: seoDescription,
          }),
          buildBreadcrumbSchema({
            baseUrl: canonicalBase || (typeof window !== 'undefined' ? window.location.origin : ''),
            items: [
              { name: t('common.home'), path: ROUTES.home },
              { name: t('blog.title'), path: ROUTES.blog },
            ],
          }),
          buildBlogSchema({
            baseUrl: canonicalBase || (typeof window !== 'undefined' ? window.location.origin : ''),
            siteName: siteTitle,
            description: seoDescription,
            path: ROUTES.blog,
          }),
        ]}
      />
      <section className="bg-gradient-to-br from-red-50 via-white to-pink-50 py-14">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-extrabold text-gray-900">{blogHeading}</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            {t('blog.intro')}
          </p>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 lg:grid-cols-[15%_85%]">
            <aside className="space-y-2 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-red-100 bg-white p-2 shadow-sm">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600">{t('blog.filters')}</p>
                <label className="text-[11px] font-semibold text-gray-700">{t('blog.searchArticles')}</label>
                <input
                  type="search"
                  value={searchParams.get('q') || ''}
                  onChange={(event) => applyParams({ q: event.target.value })}
                  placeholder={t('blog.searchPlaceholder')}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                />
                <label className="mt-2 block text-[11px] font-semibold text-gray-700">{t('blog.sortArticles')}</label>
                <select
                  value={selectedSort}
                  onChange={(event) => applyParams({ sort: event.target.value as 'newest' | 'oldest' })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="newest">{t('blog.newestFirst')}</option>
                  <option value="oldest">{t('blog.oldestFirst')}</option>
                </select>
                <p className="mt-2 text-[11px] font-semibold text-gray-700">{t('blog.topics')}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => applyParams({ category: 'all' })}
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                      effectiveCategory === 'all'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('blog.allTopics')}
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => applyParams({ category })}
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                        effectiveCategory === category
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {toHumanLabel(category)}
                    </button>
                  ))}
                </div>
                <label className="mt-2 block text-[11px] font-semibold text-gray-700">{t('blog.series')}</label>
                <select
                  value={effectiveSeries}
                  onChange={(event) => applyParams({ series: event.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="all">{t('cms.allSeries')}</option>
                  {series.map((entry) => (
                    <option key={entry} value={entry}>{toHumanLabel(entry)}</option>
                  ))}
                </select>
                <label className="mt-2 block text-[11px] font-semibold text-gray-700">{t('blog.writtenBy')}</label>
                <select
                  value={effectiveAuthor}
                  onChange={(event) => applyParams({ author: event.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="all">{t('blog.allAuthors')}</option>
                  {authors.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('q');
                    params.delete('sort');
                    params.delete('category');
                    params.delete('series');
                    params.delete('author');
                    params.delete('page');
                    setSearchParams(params);
                  }}
                  className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {t('common.resetFilters')}
                </button>
              </div>
            </aside>
            <div className="space-y-4">
              {postsQuery.isLoading && posts.length === 0 && !loadingStalled ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`blog-skeleton-${index}`} className="h-56 animate-pulse rounded-2xl border border-red-100 bg-white" />
                  ))}
                </div>
              ) : postsQuery.isLoading && posts.length === 0 && loadingStalled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900 shadow-sm">
                  {t('blog.loadingSlowly')}
                  <div className="mt-3 flex justify-center gap-2">
                    <button type="button" onClick={() => void postsQuery.refetch()} className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100">
                      {t('common.retry')}
                    </button>
                    <button type="button" onClick={() => void refreshAppCache()} className="rounded-md border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
                      {t('common.refreshAppCache')}
                    </button>
                  </div>
                </div>
              ) : postsQuery.isError && posts.length === 0 ? (
                <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-600 shadow-sm">
                  {t('blog.loadFailed')}
                  <div className="mt-3 flex justify-center gap-2">
                    <button type="button" onClick={() => void postsQuery.refetch()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                      {t('common.retry')}
                    </button>
                    <button type="button" onClick={() => void refreshAppCache()} className="rounded-md border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                      {t('common.refreshAppCache')}
                    </button>
                  </div>
                </div>
              ) : sortedPosts.length === 0 ? (
                <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-600 shadow-sm">
                  {effectiveCategory === 'all' && effectiveSeries === 'all' && effectiveAuthor === 'all'
                    ? t('blog.noPublishedPosts')
                    : t('blog.noPostsForFilters')}
                  {hasActiveFilters ? (
                    <p className="mt-2 text-xs text-gray-500">
                      {t('blog.broadenSearch')}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      {t('blog.checkBackSoon')}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {postsQuery.isError ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                      {t('blog.showingCachedPosts')}
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pagedPosts.map((post) => {
                      const publishedAt = toDateValue(post.publishedAt);
                      const postTitle = pickLocalizedCmsString(i18n.resolvedLanguage, post.titleByLocale, post.title) || post.title;
                      const postExcerpt = pickLocalizedCmsString(i18n.resolvedLanguage, post.excerptByLocale, post.excerpt) || t('blog.noExcerpt');
                      const readingMinutes = Math.max(1, Math.ceil(((postExcerpt || '').split(/\s+/).filter(Boolean).length || 120) / 180));
                      return (
                        <article key={post.id} className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                          {post.coverImageUrl ? (
                            <img
                              src={post.coverImageUrl}
                              alt={postTitle}
                              className="h-40 w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="h-40 w-full bg-gradient-to-br from-red-100 to-red-50" />
                          )}
                          <div className="space-y-3 p-4">
                            <h2 className="line-clamp-2 text-lg font-bold text-gray-900">{postTitle}</h2>
                            <p className="line-clamp-3 text-sm text-gray-600">{postExcerpt}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{publishedAt ? publishedAt.toLocaleDateString(i18n.resolvedLanguage) : t('admin.notAvailable')}</span>
                              {post.categorySlug ? <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{toHumanLabel(post.categorySlug)}</span> : null}
                              <span>{t('blog.minRead', { count: readingMinutes })}</span>
                            </div>
                            <Link
                              to={ROUTES.blogPost.replace(':slug', post.slug)}
                              className="inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                              onMouseEnter={() => prefetchPostBySlug(post.slug)}
                              onFocus={() => prefetchPostBySlug(post.slug)}
                              onTouchStart={() => prefetchPostBySlug(post.slug)}
                            >
                              {t('blog.readArticle')}
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm shadow-sm">
                    <div>
                      <p className="text-gray-600">{t('common.page', { current: currentPage, total: totalPages })}</p>
                      <p className="text-xs text-gray-500">{t('common.showingRangeOfTotal', { start: pageStartItem, end: pageEndItem, total: sortedPosts.length })} {t('blog.postsLabel')}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => applyParams({ page: 1 })}
                        disabled={currentPage <= 1}
                        className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                      >
                        {t('common.first')}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyParams({ page: Math.max(1, currentPage - 1) })}
                        disabled={currentPage <= 1}
                        className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                      >
                        {t('cms.prev')}
                      </button>
                      {pageItems.map((item, index) => (
                        item === 'ellipsis' ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-gray-400">...</span>
                        ) : (
                          <button
                            key={`page-${item}`}
                            type="button"
                            onClick={() => applyParams({ page: item })}
                            className={`rounded-md border px-3 py-1.5 font-semibold ${
                              item === currentPage
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-gray-300 text-gray-700'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      ))}
                      <button
                        type="button"
                        onClick={() => applyParams({ page: Math.min(totalPages, currentPage + 1) })}
                        disabled={currentPage >= totalPages}
                        className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                      >
                        {t('common.next')}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyParams({ page: totalPages })}
                        disabled={currentPage >= totalPages}
                        className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                      >
                        {t('common.last')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Tag } from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { CMS_DEFAULTS, CMS_LIMITS, CMS_QUERY_LIMITS } from '../constants/cms';
import { usePublishedBlogPosts, usePublicCmsSettings } from '../hooks/useCmsContent';
import { toDateValue } from '../utils/dateValue';
import SeoHead from '../components/SeoHead';

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queueReady, setQueueReady] = useState(false);
  const [loadingStalled, setLoadingStalled] = useState(false);
  const settingsQuery = usePublicCmsSettings();
  const postsPerPage = Math.max(
    CMS_LIMITS.blogPostsPageSizeMin,
    Math.min(CMS_LIMITS.blogPostsPageSizeMax, Number(settingsQuery.data?.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage))
  );
  const showFeaturedOnBlog = settingsQuery.data?.showFeaturedOnBlog ?? CMS_DEFAULTS.showFeaturedOnBlog;
  const seoTitle = settingsQuery.data?.defaultSeoTitle || CMS_DEFAULTS.defaultSeoTitle;
  const seoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const canonicalBase = canonicalBaseUrl.replace(/\/+$/, '');
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';
  const postsQuery = usePublishedBlogPosts(CMS_QUERY_LIMITS.publicBlogList, queueReady);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setQueueReady(true);
      return;
    }
    const ticket = window.setTimeout(() => setQueueReady(true), 0);
    return () => window.clearTimeout(ticket);
  }, []);

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

  const selectedCategory = searchParams.get('category') || 'all';
  const rawPage = Number(searchParams.get('page') || '1');
  const activePage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const posts = postsQuery.data || [];

  useEffect(() => {
    if (!queueReady || !postsQuery.isLoading || posts.length > 0) {
      setLoadingStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingStalled(true), 15000);
    return () => window.clearTimeout(timer);
  }, [queueReady, posts.length, postsQuery.isLoading]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => {
      if (post.categorySlug) set.add(post.categorySlug);
    });
    return Array.from(set).sort();
  }, [posts]);

  const effectiveCategory = (
    selectedCategory === 'all' || categories.includes(selectedCategory)
      ? selectedCategory
      : 'all'
  );

  const filteredPosts = useMemo(() => (
    effectiveCategory === 'all'
      ? posts
      : posts.filter((post) => post.categorySlug === effectiveCategory)
  ), [posts, effectiveCategory]);

  const featuredPosts = useMemo(
    () => posts.filter((post) => post.featured).slice(0, 3),
    [posts]
  );

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
  const currentPage = Math.min(activePage, totalPages);
  const pagedPosts = useMemo(() => {
    const start = (currentPage - 1) * postsPerPage;
    return filteredPosts.slice(start, start + postsPerPage);
  }, [filteredPosts, currentPage, postsPerPage]);

  const applyParams = (next: { category?: string; page?: number }) => {
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
    setSearchParams(params);
  };

  return (
    <div className="w-full public-app-page public-app-blog">
      <SeoHead
        title={`${seoTitle} | Blog`}
        description={seoDescription}
        canonicalPath={ROUTES.blog}
        canonicalBaseUrl={canonicalBaseUrl}
        ogImageUrl={defaultOgImageUrl || undefined}
        twitterImageUrl={defaultOgImageUrl || undefined}
        robots={robotsPolicy}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: `${seoTitle} Blog`,
          description: seoDescription,
          url: `${canonicalBase || (typeof window !== 'undefined' ? window.location.origin : '')}${ROUTES.blog}`,
        }}
      />
      <section className="bg-gradient-to-br from-red-50 via-white to-pink-50 py-14">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-extrabold text-gray-900">Blog</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Stories, updates, and practical blood donation guidance from the BloodHub team.</p>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4 space-y-4">
          {showFeaturedOnBlog && effectiveCategory === 'all' && currentPage === 1 && featuredPosts.length > 0 ? (
            <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Featured</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {featuredPosts.map((post) => (
                  <Link
                    key={`featured-${post.id}`}
                    to={ROUTES.blogPost.replace(':slug', post.slug)}
                    className="rounded-xl border border-red-100 p-3 transition hover:bg-red-50"
                  >
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">{post.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{post.excerpt || 'Read the full article.'}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                  onClick={() => applyParams({ category: 'all' })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    effectiveCategory === 'all'
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => applyParams({ category })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    effectiveCategory === category
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}

          {postsQuery.isLoading && posts.length === 0 && !loadingStalled ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`blog-skeleton-${index}`} className="h-56 animate-pulse rounded-2xl border border-red-100 bg-white" />
              ))}
            </div>
          ) : postsQuery.isLoading && posts.length === 0 && loadingStalled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900 shadow-sm">
              Blog is taking longer than expected to load.
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" onClick={() => void postsQuery.refetch()} className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100">
                  Retry
                </button>
                <button type="button" onClick={() => void refreshAppCache()} className="rounded-md border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
                  Refresh App Cache
                </button>
              </div>
            </div>
          ) : postsQuery.isError && posts.length === 0 ? (
            <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-600 shadow-sm">
              Failed to load blog posts. Please try again.
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" onClick={() => void postsQuery.refetch()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  Retry
                </button>
                <button type="button" onClick={() => void refreshAppCache()} className="rounded-md border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                  Refresh App Cache
                </button>
              </div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-600 shadow-sm">
              {effectiveCategory === 'all' ? 'No published blog posts yet.' : `No posts found for category "${effectiveCategory}".`}
            </div>
          ) : (
            <>
              {postsQuery.isError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                  Showing cached posts. Latest refresh failed.
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagedPosts.map((post) => {
                  const publishedAt = toDateValue(post.publishedAt);
                  return (
                    <article key={post.id} className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      {post.coverImageUrl ? (
                        <img src={post.coverImageUrl} alt={post.title} className="h-40 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-40 w-full bg-gradient-to-br from-red-100 to-red-50" />
                      )}
                      <div className="space-y-3 p-4">
                        <h2 className="line-clamp-2 text-lg font-bold text-gray-900">{post.title}</h2>
                        <p className="line-clamp-3 text-sm text-gray-600">{post.excerpt || 'No excerpt available for this post.'}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{publishedAt ? publishedAt.toLocaleDateString() : 'N/A'}</span>
                          {post.categorySlug ? <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{post.categorySlug}</span> : null}
                        </div>
                        <Link to={ROUTES.blogPost.replace(':slug', post.slug)} className="inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                          Read article
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm shadow-sm">
                <p className="text-gray-600">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => applyParams({ page: Math.max(1, currentPage - 1) })}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => applyParams({ page: Math.min(totalPages, currentPage + 1) })}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

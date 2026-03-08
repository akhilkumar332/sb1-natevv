import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Tag } from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { CMS_DEFAULTS, CMS_QUERY_LIMITS, CMS_SEO_DEFAULTS } from '../constants/cms';
import { usePublishedBlogPostBySlug, usePublishedBlogPosts, usePublicCmsSettings } from '../hooks/useCmsContent';
import { toDateValue } from '../utils/dateValue';
import SeoHead from '../components/SeoHead';
import { buildArticleSchema, buildBreadcrumbSchema } from '../utils/seoStructuredData';

const renderContent = (contentJson?: string | null) => {
  if (!contentJson) return ['Content coming soon.'];
  try {
    const parsed = JSON.parse(contentJson) as { blocks?: Array<{ text?: string }> };
    if (!Array.isArray(parsed.blocks)) return [contentJson];
    return parsed.blocks
      .map((block) => (typeof block?.text === 'string' ? block.text : ''))
      .filter(Boolean);
  } catch {
    return [contentJson];
  }
};

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const postQuery = usePublishedBlogPostBySlug(slug);
  const allPostsQuery = usePublishedBlogPosts(CMS_QUERY_LIMITS.publicBlogList, true);
  const settingsQuery = usePublicCmsSettings();
  const siteTitle = settingsQuery.data?.siteTitle || CMS_DEFAULTS.siteTitle;
  const defaultSeoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';

  const resolvedTitle = postQuery.data?.seoTitle || postQuery.data?.title || 'Blog';
  const resolvedDescription = postQuery.data?.seoDescription || postQuery.data?.excerpt || defaultSeoDescription;
  const canonicalPath = ROUTES.blogPost.replace(':slug', slug);

  if (postQuery.isLoading) {
    return (
      <>
        <SeoHead title={`${siteTitle} | Blog`} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="h-96 animate-pulse rounded-2xl border border-red-100 bg-white" />
        </div>
      </>
    );
  }

  if (postQuery.isError) {
    return (
      <>
        <SeoHead title={`${siteTitle} | Blog`} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Unable to load post</h1>
            <p className="mt-2 text-sm text-gray-600">Please try again in a moment.</p>
            <Link to={ROUTES.blog} className="mt-4 inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
              Back to Blog
            </Link>
          </div>
        </div>
      </>
    );
  }

  const post = postQuery.data;
  if (!post) {
    return (
      <>
        <SeoHead title={`${siteTitle} | Blog`} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
            <p className="mt-2 text-sm text-gray-600">The requested article is unavailable or not published.</p>
            <Link to={ROUTES.blog} className="mt-4 inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
              Back to Blog
            </Link>
          </div>
        </div>
      </>
    );
  }

  const paragraphs = renderContent(post.contentJson);
  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const publishedAt = toDateValue(post.publishedAt);
  const canonicalUrl = post.seoCanonicalUrl || undefined;
  const ogImageUrl = post.ogImageUrl || post.coverImageUrl || defaultOgImageUrl || undefined;
  const twitterImageUrl = post.twitterImageUrl || ogImageUrl;
  const postRobots = post.seoNoIndex || post.seoNoFollow
    ? 'noindex,nofollow'
    : robotsPolicy;
  const modifiedAtIso = toDateValue(post.updatedAt)?.toISOString();
  const publishedAtIso = publishedAt ? publishedAt.toISOString() : undefined;
  const breadcrumbSchema = buildBreadcrumbSchema({
    baseUrl: canonicalBaseUrl,
    items: [
      { name: 'Home', path: ROUTES.home },
      { name: 'Blog', path: ROUTES.blog },
      { name: post.title, path: canonicalPath },
    ],
  });
  const articleSchema = buildArticleSchema({
    baseUrl: canonicalBaseUrl,
    path: canonicalPath,
    headline: post.title,
    description: resolvedDescription,
    imageUrl: ogImageUrl,
    datePublished: publishedAtIso,
    dateModified: modifiedAtIso,
    authorName: post.authorName || undefined,
    publisherName: siteTitle,
  });
  const relatedPosts = (allPostsQuery.data || [])
    .filter((entry) => entry.slug !== post.slug && (
      (post.relatedPostSlugs || []).includes(entry.slug)
      || (post.seriesSlug && entry.seriesSlug === post.seriesSlug)
      || (post.categorySlug && entry.categorySlug === post.categorySlug)
      || (entry.tags || []).some((tag) => (post.tags || []).includes(tag))
    ))
    .slice(0, 3);
  const shareUrl = `${canonicalBaseUrl.replace(/\/+$/, '')}${canonicalPath}`;
  const shareText = encodeURIComponent(post.title);

  return (
    <article className="pb-10">
      <SeoHead
        title={`${resolvedTitle} | ${siteTitle}`}
        description={resolvedDescription}
        type="article"
        siteName={siteTitle}
        locale={CMS_SEO_DEFAULTS.locale}
        canonicalPath={canonicalPath}
        canonicalBaseUrl={canonicalBaseUrl}
        canonicalUrl={canonicalUrl}
        ogImageUrl={ogImageUrl}
        twitterImageUrl={twitterImageUrl}
        twitterHandle={settingsQuery.data?.twitterHandle || undefined}
        publishedTime={publishedAtIso}
        modifiedTime={modifiedAtIso}
        authorName={post.authorName || undefined}
        robots={postRobots}
        structuredData={[breadcrumbSchema, articleSchema]}
      />
      <div className="bg-gradient-to-br from-red-50 via-white to-pink-50 py-10">
        <div className="container mx-auto px-4">
          <Link to={ROUTES.blog} className="text-sm font-semibold text-red-700 hover:underline">← Back to Blog</Link>
          <h1 className="mt-3 max-w-4xl text-3xl font-extrabold text-gray-900 sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{publishedAt ? publishedAt.toLocaleString() : 'N/A'}</span>
            {post.categorySlug ? <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{post.categorySlug}</span> : null}
            {post.seriesSlug ? (
              <Link to={`${ROUTES.blog}?series=${encodeURIComponent(post.seriesSlug)}`} className="rounded-full border border-gray-300 px-2 py-0.5 font-semibold text-gray-700 hover:bg-gray-50">
                Series: {post.seriesSlug}
              </Link>
            ) : null}
            {post.authorName ? (
              <Link to={`${ROUTES.blog}?author=${encodeURIComponent(post.authorName)}`} className="rounded-full border border-gray-300 px-2 py-0.5 font-semibold text-gray-700 hover:bg-gray-50">
                By {post.authorName}
              </Link>
            ) : null}
            <span>{readingMinutes} min read</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
          {post.coverImageUrl ? (
            <img src={post.coverImageUrl} alt={post.title} className="mb-6 h-auto w-full rounded-xl object-cover" loading="lazy" />
          ) : null}
          <div className="space-y-4 text-base leading-7 text-gray-700">
            {paragraphs.map((line, index) => <p key={`line-${index}`}>{line}</p>)}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-gray-700">Share:</span>
            <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">X</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">LinkedIn</a>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  void navigator.clipboard.writeText(shareUrl);
                }
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Copy Link
            </button>
          </div>
          {relatedPosts.length ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900">Related Articles</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {relatedPosts.map((entry) => (
                  <Link key={entry.id} to={ROUTES.blogPost.replace(':slug', entry.slug)} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-red-50">
                    {entry.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

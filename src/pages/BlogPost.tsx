import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Tag, Linkedin, Share2, Copy, Check } from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { CMS_DEFAULTS, CMS_QUERY_LIMITS, CMS_SEO_DEFAULTS } from '../constants/cms';
import { usePublishedBlogPostBySlug, usePublishedBlogPosts, usePublicCmsSettings } from '../hooks/useCmsContent';
import { toDateValue } from '../utils/dateValue';
import SeoHead from '../components/SeoHead';
import { buildArticleSchema, buildBreadcrumbSchema } from '../utils/seoStructuredData';
import { parseCmsRichContent } from '../utils/cmsRichContent';

function XBrandIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.9 2H22l-6.77 7.73L23.2 22h-6.27l-4.91-6.76L6.1 22H3l7.23-8.26L.8 2h6.35l4.44 6.2L18.9 2zm-1.1 18h1.74L6.22 3.9H4.35L17.8 20z" />
    </svg>
  );
}

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const [readingProgress, setReadingProgress] = useState(0);
  const [readerTextSize, setReaderTextSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [readerComfort, setReaderComfort] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showJumpTop, setShowJumpTop] = useState(false);
  const postQuery = usePublishedBlogPostBySlug(slug);
  const allPostsQuery = usePublishedBlogPosts(CMS_QUERY_LIMITS.publicBlogList, Boolean(postQuery.data));
  const settingsQuery = usePublicCmsSettings();
  const post = postQuery.data || null;
  const siteTitle = settingsQuery.data?.siteTitle || CMS_DEFAULTS.siteTitle;
  const defaultSeoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';

  const resolvedTitle = post?.seoTitle || post?.title || 'Blog';
  const resolvedDescription = post?.seoDescription || post?.excerpt || defaultSeoDescription;
  const canonicalPath = ROUTES.blogPost.replace(':slug', slug);
  const renderedContent = useMemo(
    () => parseCmsRichContent(post?.contentJson || ''),
    [post?.contentJson],
  );
  const tableOfContents = useMemo(() => {
    if (typeof window === 'undefined' || !renderedContent.html) return [];
    try {
      const doc = new window.DOMParser().parseFromString(renderedContent.html, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h2, h3'))
        .map((node, index) => {
          const text = node.textContent?.trim() || '';
          if (!text) return null;
          const id = `toc-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
          return { id, text, level: node.tagName === 'H2' ? 2 : 3 };
        })
        .filter((entry): entry is { id: string; text: string; level: 2 | 3 } => Boolean(entry));
      return headings;
    } catch {
      return [];
    }
  }, [renderedContent.html]);
  const contentHtmlWithAnchors = useMemo(() => {
    if (!renderedContent.html || tableOfContents.length === 0) return renderedContent.html;
    if (typeof window === 'undefined') return renderedContent.html;
    try {
      const doc = new window.DOMParser().parseFromString(renderedContent.html, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h2, h3'));
      headings.forEach((node, index) => {
        const toc = tableOfContents[index];
        if (!toc) return;
        node.setAttribute('id', toc.id);
      });
      return doc.body.innerHTML;
    } catch {
      return renderedContent.html;
    }
  }, [renderedContent.html, tableOfContents]);
  const seriesPosts = useMemo(
    () => (allPostsQuery.data || [])
      .filter((entry) => post?.seriesSlug && entry.seriesSlug === post.seriesSlug)
      .sort((a, b) => {
        const aTs = toDateValue(a.publishedAt)?.getTime() || 0;
        const bTs = toDateValue(b.publishedAt)?.getTime() || 0;
        return aTs - bTs;
      }),
    [allPostsQuery.data, post?.seriesSlug],
  );
  const currentSeriesIndex = useMemo(
    () => (post ? seriesPosts.findIndex((entry) => entry.slug === post.slug) : -1),
    [seriesPosts, post],
  );
  const previousInSeries = currentSeriesIndex > 0 ? seriesPosts[currentSeriesIndex - 1] : null;
  const nextInSeries = currentSeriesIndex >= 0 && currentSeriesIndex < seriesPosts.length - 1 ? seriesPosts[currentSeriesIndex + 1] : null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorageHydrate = () => {
      try {
        const savedSize = window.localStorage.getItem('blog_reader_text_size');
        const savedComfort = window.localStorage.getItem('blog_reader_comfort');
        const savedFocus = window.localStorage.getItem('blog_reader_focus');
        if (savedSize === 'sm' || savedSize === 'md' || savedSize === 'lg') setReaderTextSize(savedSize);
        if (savedComfort === '1') setReaderComfort(true);
        if (savedFocus === '1') setFocusMode(true);
      } catch {
        // ignore storage access errors
      }
    };
    const onScroll = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(100, (window.scrollY / total) * 100));
      setReadingProgress(progress);
      setShowJumpTop(window.scrollY > 420);
    };
    onStorageHydrate();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('blog_reader_text_size', readerTextSize);
      window.localStorage.setItem('blog_reader_comfort', readerComfort ? '1' : '0');
      window.localStorage.setItem('blog_reader_focus', focusMode ? '1' : '0');
    } catch {
      // ignore storage access errors
    }
  }, [readerTextSize, readerComfort, focusMode]);

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

  const wordCount = renderedContent.plainText.split(/\s+/).filter(Boolean).length;
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
  const featuredPosts = (allPostsQuery.data || [])
    .filter((entry) => {
      if (entry.slug === post.slug || !entry.featured) return false;
      const expiry = toDateValue(entry.featuredUntil);
      return !expiry || expiry.getTime() > Date.now();
    })
    .slice(0, 3);
  const shareUrl = `${canonicalBaseUrl.replace(/\/+$/, '')}${canonicalPath}`;
  const shareText = encodeURIComponent(post.title);
  const textSizeClass = readerTextSize === 'sm' ? 'text-sm' : readerTextSize === 'lg' ? 'text-lg' : 'text-base';
  const lineHeightClass = readerComfort ? 'leading-8' : 'leading-7';

  return (
    <article className={`pb-10 ${focusMode ? 'bg-gray-50' : ''}`}>
      <div className="fixed left-0 right-0 top-0 z-40 h-1 bg-transparent">
        <div className="h-1 bg-red-600 transition-[width] duration-150" style={{ width: `${readingProgress}%` }} />
      </div>
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
          <h1 className="mt-3 max-w-5xl text-3xl font-extrabold text-gray-900 sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{publishedAt ? publishedAt.toLocaleString() : 'N/A'}</span>
            {post.categorySlug ? <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{post.categorySlug}</span> : null}
            {post.seriesSlug ? (
              <Link to={ROUTES.blogSeries.replace(':seriesSlug', encodeURIComponent(post.seriesSlug))} className="rounded-full border border-gray-300 px-2 py-0.5 font-semibold text-gray-700 hover:bg-gray-50">
                Series: {post.seriesSlug}
              </Link>
            ) : null}
            {post.authorName ? (
              <Link to={ROUTES.blogAuthor.replace(':authorName', encodeURIComponent(post.authorName))} className="rounded-full border border-gray-300 px-2 py-0.5 font-semibold text-gray-700 hover:bg-gray-50">
                By {post.authorName}
              </Link>
            ) : null}
            <span>{readingMinutes} min read</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">Reader settings</span>
              <button type="button" onClick={() => setReaderTextSize('sm')} className={`rounded border px-2 py-1 text-xs ${readerTextSize === 'sm' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>S</button>
              <button type="button" onClick={() => setReaderTextSize('md')} className={`rounded border px-2 py-1 text-xs ${readerTextSize === 'md' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>M</button>
              <button type="button" onClick={() => setReaderTextSize('lg')} className={`rounded border px-2 py-1 text-xs ${readerTextSize === 'lg' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>L</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setReaderComfort((prev) => !prev)} className={`rounded border px-2 py-1 text-xs font-semibold ${readerComfort ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>
                Comfortable spacing
              </button>
              <button type="button" onClick={() => setFocusMode((prev) => !prev)} className={`rounded border px-2 py-1 text-xs font-semibold ${focusMode ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>
                Focus mode
              </button>
            </div>
          </div>
          {post.coverImageUrl ? (
            <img src={post.coverImageUrl} alt={post.title} className="mb-6 h-auto w-full rounded-xl object-cover" loading="lazy" />
          ) : null}
          {renderedContent.html ? (
            <div
              id="blog-article-content"
              className={`${textSizeClass} ${lineHeightClass} text-gray-700 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-red-200 [&_blockquote]:pl-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6`}
              dangerouslySetInnerHTML={{ __html: contentHtmlWithAnchors }}
            />
          ) : (
            <div className="space-y-4 text-base leading-7 text-gray-700">
              <p>Content coming soon.</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-gray-700">Share:</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Share on X"
              title="Share on X"
              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
            >
              <XBrandIcon className="h-4 w-4" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Share on LinkedIn"
              title="Share on LinkedIn"
              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                  void navigator.share({ title: post.title, url: shareUrl }).catch(() => undefined);
                }
              }}
              aria-label="Share"
              title="Share"
              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  void navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopiedLink(true);
                    window.setTimeout(() => setCopiedLink(false), 1400);
                  }).catch(() => undefined);
                }
              }}
              aria-label={copiedLink ? 'Copied link' : 'Copy link'}
              title={copiedLink ? 'Copied' : 'Copy link'}
              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {featuredPosts.length ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">Featured Articles</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {featuredPosts.map((entry) => (
                  <Link key={`featured-${entry.id}`} to={ROUTES.blogPost.replace(':slug', entry.slug)} className="rounded-lg border border-red-100 bg-red-50/30 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-red-50">
                    {entry.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {tableOfContents.length ? (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">On this page</p>
              <div className="mt-2 space-y-1">
                {tableOfContents.map((entry) => (
                  <a
                    key={entry.id}
                    href={`#${entry.id}`}
                    className={`block text-xs text-blue-700 hover:underline ${entry.level === 3 ? 'pl-3' : ''}`}
                  >
                    {entry.text}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {(previousInSeries || nextInSeries) ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900">Series navigation</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {previousInSeries ? (
                  <Link to={ROUTES.blogPost.replace(':slug', previousInSeries.slug)} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-red-50">
                    ← {previousInSeries.title}
                  </Link>
                ) : <div />}
                {nextInSeries ? (
                  <Link to={ROUTES.blogPost.replace(':slug', nextInSeries.slug)} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-red-50 text-right">
                    {nextInSeries.title} →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {showJumpTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-40 rounded-full border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-md hover:bg-red-50"
        >
          Top
        </button>
      ) : null}
    </article>
  );
}

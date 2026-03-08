const CMS_RICH_CONTENT_FORMAT = 'rich_html_v1';

type RichContentEnvelope = {
  format: typeof CMS_RICH_CONTENT_FORMAT;
  html: string;
  plainText: string;
};

type LegacyBlocks = {
  blocks?: Array<{ text?: string }>;
};

const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const stripHtml = (value: string): string => (
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const sanitizeHref = (href: string): string => {
  const normalized = href.trim();
  if (!normalized) return '';
  if (/^(javascript|data|vbscript):/i.test(normalized)) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return normalized;
  return '';
};

const allowedTags = new Set([
  'P',
  'BR',
  'STRONG',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
  'BLOCKQUOTE',
  'CODE',
  'A',
]);

const sanitizeNode = (node: Node, doc: Document): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as HTMLElement;
  const tagName = element.tagName.toUpperCase();
  if (!allowedTags.has(tagName)) {
    const fragment = doc.createDocumentFragment();
    Array.from(element.childNodes).forEach((child) => {
      const sanitized = sanitizeNode(child, doc);
      if (sanitized) fragment.appendChild(sanitized);
    });
    return fragment;
  }

  const cleanEl = doc.createElement(tagName.toLowerCase());
  if (tagName === 'A') {
    const href = sanitizeHref(element.getAttribute('href') || '');
    if (href) {
      cleanEl.setAttribute('href', href);
      cleanEl.setAttribute('rel', 'noopener noreferrer');
      cleanEl.setAttribute('target', href.startsWith('/') ? '_self' : '_blank');
    }
  }
  Array.from(element.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child, doc);
    if (sanitized) cleanEl.appendChild(sanitized);
  });
  return cleanEl;
};

export const sanitizeRichHtml = (input: string): string => {
  const raw = (input || '').trim();
  if (!raw) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(stripHtml(raw)).replace(/\n/g, '<br>');
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  const outputDoc = document.implementation.createHTMLDocument('');
  const wrapper = outputDoc.createElement('div');

  Array.from(parsed.body.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child, outputDoc);
    if (sanitized) wrapper.appendChild(sanitized);
  });

  return wrapper.innerHTML.trim();
};

export const serializeCmsRichContent = (html: string): string => {
  const safeHtml = sanitizeRichHtml(html);
  const envelope: RichContentEnvelope = {
    format: CMS_RICH_CONTENT_FORMAT,
    html: safeHtml,
    plainText: stripHtml(safeHtml),
  };
  return JSON.stringify(envelope);
};

const textToParagraphsHtml = (plainText: string): string => {
  const lines = plainText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};

const parseLegacyBlocks = (value: unknown): string => {
  const parsed = value as LegacyBlocks;
  if (!Array.isArray(parsed?.blocks)) return '';
  const lines = parsed.blocks
    .map((block) => (typeof block?.text === 'string' ? block.text.trim() : ''))
    .filter(Boolean);
  return lines.join('\n');
};

export const parseCmsRichContent = (contentJson?: string | null): { html: string; plainText: string } => {
  const raw = (contentJson || '').trim();
  if (!raw) return { html: '', plainText: '' };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed?.format === CMS_RICH_CONTENT_FORMAT && typeof parsed.html === 'string') {
      const html = sanitizeRichHtml(parsed.html);
      const plainText = typeof parsed.plainText === 'string' ? parsed.plainText : stripHtml(html);
      return { html, plainText: plainText.trim() };
    }

    const legacyText = parseLegacyBlocks(parsed);
    if (legacyText) {
      return {
        html: textToParagraphsHtml(legacyText),
        plainText: legacyText,
      };
    }
  } catch {
    return {
      html: textToParagraphsHtml(raw),
      plainText: raw,
    };
  }

  return {
    html: textToParagraphsHtml(raw),
    plainText: raw,
  };
};

export const extractCmsPlainText = (contentJson?: string | null): string => (
  parseCmsRichContent(contentJson).plainText
);

export const appendInternalLinkToCmsRichContent = (
  contentJson: string,
  label: string,
  path: string
): string => {
  const safePath = sanitizeHref(path);
  const safeLabel = label.trim();
  if (!safePath || !safeLabel) return contentJson;

  const parsed = parseCmsRichContent(contentJson);
  const currentHtml = parsed.html || '';
  const nextHtml = `${currentHtml}${currentHtml ? '' : ''}<p><a href="${escapeHtml(safePath)}">${escapeHtml(safeLabel)}</a></p>`;
  return serializeCmsRichContent(nextHtml);
};

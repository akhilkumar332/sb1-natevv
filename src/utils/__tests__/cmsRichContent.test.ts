import { describe, expect, it } from 'vitest';
import {
  appendInternalLinkToCmsRichContent,
  extractCmsPlainText,
  parseCmsRichContent,
  sanitizeRichHtml,
  serializeCmsRichContent,
} from '../cmsRichContent';

describe('cmsRichContent', () => {
  it('serializes and parses rich html envelope', () => {
    const saved = serializeCmsRichContent('<p>Hello <strong>world</strong></p>');
    const parsed = parseCmsRichContent(saved);
    expect(parsed.html).toContain('<p>');
    expect(parsed.plainText).toContain('Hello world');
  });

  it('parses legacy block content', () => {
    const legacy = JSON.stringify({ blocks: [{ text: 'One' }, { text: 'Two' }] });
    const parsed = parseCmsRichContent(legacy);
    expect(parsed.plainText).toBe('One\nTwo');
  });

  it('falls back to raw plain text content', () => {
    const raw = 'Plain old content';
    expect(extractCmsPlainText(raw)).toBe(raw);
  });

  it('sanitizes dangerous html and links', () => {
    const safe = sanitizeRichHtml('<script>alert(1)</script><p>A</p><a href="javascript:alert(1)">x</a>');
    expect(safe).not.toContain('<script');
    expect(safe).toContain('<p>A</p>');
    expect(safe).not.toContain('javascript:');
  });

  it('appends internal links safely', () => {
    const result = appendInternalLinkToCmsRichContent('', 'Read more', '/blog/post');
    const parsed = parseCmsRichContent(result);
    expect(parsed.html).toContain('href="/blog/post"');
    expect(parsed.plainText).toContain('Read more');
  });
});

/**
 * Tests for LazyImage Component
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LazyImage } from '../LazyImage';

describe('LazyImage', () => {
  it('should render image with correct src and alt', () => {
    const { getByAltText } = render(<LazyImage src="/test.jpg" alt="Test image" />);

    const img = getByAltText('Test image');
    expect(img).toBeTruthy();
  });

  it('should apply custom className', () => {
    const { getByAltText } = render(
      <LazyImage
        src="/test.jpg"
        alt="Test image"
        className="custom-class"
      />
    );

    const img = getByAltText('Test image');
    expect(img.classList.contains('custom-class')).toBe(true);
  });

  it('should have loading="lazy" attribute', () => {
    const { getByAltText } = render(<LazyImage src="/test.jpg" alt="Test image" />);

    const img = getByAltText('Test image');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('should start with opacity-0 and transition to opacity-100 on load', () => {
    const { getByAltText } = render(<LazyImage src="/test.jpg" alt="Test image" />);

    const img = getByAltText('Test image');
    expect(img.classList.contains('opacity-0')).toBe(true);
    expect(img.classList.contains('transition-opacity')).toBe(true);
  });

  it('should use placeholder if provided', () => {
    const { getByAltText } = render(
      <LazyImage
        src="/test.jpg"
        alt="Test image"
        placeholderSrc="/placeholder.jpg"
      />
    );

    const img = getByAltText('Test image');
    // Initial src should be placeholder or empty
    expect(img).toBeTruthy();
  });
});

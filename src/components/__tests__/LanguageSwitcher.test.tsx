import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    window.localStorage.clear();
  });

  it('changes language and persists the selection', async () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: /switch language/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'हिन्दी' }));

    expect(i18n.resolvedLanguage).toBe('hi');
    expect(window.localStorage.getItem('bh_language')).toBe('hi');
  });
});

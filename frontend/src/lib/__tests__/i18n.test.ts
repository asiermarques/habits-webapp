import { describe, it, expect, beforeEach } from 'vitest';
import { t, setActiveLocale, getActiveLocale } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setActiveLocale('en');
  });

  it('defaults to English', () => {
    expect(getActiveLocale()).toBe('en');
    expect(t('settings.title')).toBe('Settings');
  });

  it('returns Spanish translation when locale is es', () => {
    setActiveLocale('es');
    expect(t('settings.title')).toBe('Ajustes');
  });

  it('falls back to the key when no translation is found', () => {
    expect(t('this.key.does.not.exist' as never)).toBe('this.key.does.not.exist');
  });

  it('mirrors the locale into getLocale() as a BCP-47 tag', async () => {
    const { getLocale } = await import('../locale');
    setActiveLocale('es');
    expect(getLocale()).toBe('es-ES');
    setActiveLocale('en');
    expect(getLocale()).toBe('en-US');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestProviders } from '@/test/test-utils';
import { NotFound } from '@/pages/NotFound';
import { t } from '@/lib/i18n';

describe('NotFound', () => {
  it('renders the not-found copy and a link back home', () => {
    render(
      <TestProviders>
        <NotFound />
      </TestProviders>,
    );

    expect(screen.getByText(t('notFound.title'))).toBeInTheDocument();
    expect(screen.getByText(t('notFound.subtitle'))).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: t('notFound.back') });
    expect(backLink).toHaveAttribute('href', '/');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../Header';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('shows the app title and nav icons on home', () => {
    renderAt('/');

    expect(screen.getByText('Habits')).toBeInTheDocument();
    expect(screen.getByLabelText('Metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.queryByLabelText('Back to home')).not.toBeInTheDocument();
  });

  it('shows the back arrow on non-home routes', () => {
    renderAt('/metrics');

    expect(screen.getByLabelText('Back to home')).toBeInTheDocument();
    expect(screen.queryByLabelText('Metrics')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
  });
});

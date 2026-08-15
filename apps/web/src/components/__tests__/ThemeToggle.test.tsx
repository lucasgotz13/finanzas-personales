import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ThemeToggle from '../ThemeToggle';

describe('ThemeToggle', () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  });

  it('renders light with the dark-mode action label when no theme is set', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Modo oscuro' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('class', 'theme-toggle');
  });

  it('renders dark with the light-mode action label when data-theme is dark', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Modo claro' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('flips the theme on click: dataset, persistence, aria-pressed and the theme-color meta', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#f7f5f0';
    document.head.appendChild(meta);

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Modo oscuro' });

    fireEvent.click(button);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('finanzas-theme')).toBe('dark');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleName('Modo claro');
    expect(meta.getAttribute('content')).toBe('#1a1815');

    fireEvent.click(button);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('finanzas-theme')).toBe('light');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleName('Modo oscuro');
    expect(meta.getAttribute('content')).toBe('#f7f5f0');
  });
});

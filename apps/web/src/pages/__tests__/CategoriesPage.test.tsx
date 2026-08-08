import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { CategoryNode } from '../../types';
import CategoriesPage from '../CategoriesPage';

const tree: CategoryNode[] = [
  { id: 1, name: 'Food', parentId: null, children: [{ id: 11, name: 'Groceries', parentId: 1, children: [] }] },
];

describe('CategoriesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a category and reloads the tree (CM-1)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    const createCategory = vi.spyOn(api, 'createCategory').mockResolvedValue({ id: 12, name: 'Restaurants', parentId: 1, children: [] });
    const getTree = vi.spyOn(api, 'getCategoryTree');

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');

    await user.type(screen.getByTestId('cat-name'), 'Restaurants');
    await user.selectOptions(screen.getByTestId('cat-parent'), '1');
    await user.click(screen.getByTestId('cat-add'));

    await waitFor(() => expect(createCategory).toHaveBeenCalledWith({ name: 'Restaurants', parentId: 1 }));
    await waitFor(() => expect(getTree).toHaveBeenCalledTimes(2));
  });

  it('rejects deleting a category with children through the API error (CM-4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(new Error('Cannot delete a category with children'));

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');
    await user.click(screen.getByTestId('delete-1'));

    expect(await screen.findByText('Cannot delete a category with children')).toBeInTheDocument();
  });
});

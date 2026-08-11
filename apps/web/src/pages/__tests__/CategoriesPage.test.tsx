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
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
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

  it('requires a two-tap confirm before deleting; No cancels without calling the API', async () => {
    const deleteCategory = vi.spyOn(api, 'deleteCategory').mockResolvedValue(undefined);
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-11');

    await user.click(screen.getByTestId('delete-11'));
    expect(screen.getByTestId('confirm-delete-11')).toBeInTheDocument();
    expect(deleteCategory).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('cancel-delete-11'));
    expect(screen.queryByTestId('confirm-delete-11')).not.toBeInTheDocument();
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it('deletes after confirm and refreshes the tree and the deleted list', async () => {
    const deleteCategory = vi.spyOn(api, 'deleteCategory').mockResolvedValue(undefined);
    const getTree = vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    const getDeleted = vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-11');

    await user.click(screen.getByTestId('delete-11'));
    await user.click(screen.getByTestId('confirm-delete-11'));

    await waitFor(() => expect(deleteCategory).toHaveBeenCalledWith(11));
    await waitFor(() => expect(getTree).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getDeleted).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('confirm-delete-11')).not.toBeInTheDocument();
  });

  it('shows the API error in the error box when deleting a category with children (CM-4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(new Error('Cannot delete a category with children'));

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');
    await user.click(screen.getByTestId('delete-1'));
    await user.click(screen.getByTestId('confirm-delete-1'));

    expect(await screen.findByText('Cannot delete a category with children')).toBeInTheDocument();
    // The prompt stays open so the user can retry or cancel.
    expect(screen.getByTestId('confirm-delete-1')).toBeInTheDocument();
  });

  it('renders the deleted section with Restore and refreshes both lists on restore', async () => {
    const deletedList: CategoryNode[] = [{ id: 5, name: 'Health', parentId: null, children: [] }];
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    const getDeleted = vi.spyOn(api, 'getDeletedCategories').mockResolvedValue(deletedList);
    const restore = vi.spyOn(api, 'restoreCategory').mockResolvedValue({ id: 5, name: 'Health', parentId: null, children: [] });

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('restore-5');

    expect(screen.getByTestId('deleted-section')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();

    await user.click(screen.getByTestId('restore-5'));

    await waitFor(() => expect(restore).toHaveBeenCalledWith(5));
    await waitFor(() => expect(getDeleted).toHaveBeenCalledTimes(2));
  });

  it('hides the deleted section when nothing is deleted', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');

    expect(screen.queryByTestId('deleted-section')).not.toBeInTheDocument();
  });
});

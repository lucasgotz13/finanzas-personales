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

  it('disables Borrar for categories with children and hints to delete subcategories first (P3 #13)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');

    const parentDelete = screen.getByTestId('delete-1');
    expect(parentDelete).toBeDisabled();
    expect(parentDelete).toHaveAttribute('title', 'Primero borre sus subcategorías');

    // The leaf sibling stays actionable: no confirm can even open for a parent.
    expect(screen.getByTestId('delete-11')).not.toBeDisabled();
  });

  it('keeps the two-tap confirm and shows the API error when the delete still fails (CM-4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
    // A leaf whose delete fails (e.g. a child was added by another tab
    // between render and confirm) still surfaces the backend error.
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(new Error('Cannot delete a category with children'));

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-11');
    await user.click(screen.getByTestId('delete-11'));
    await user.click(screen.getByTestId('confirm-delete-11'));

    expect(await screen.findByText('No se puede borrar una categoría con subcategorías.')).toBeInTheDocument();
    // The prompt stays open so the user can retry or cancel.
    expect(screen.getByTestId('confirm-delete-11')).toBeInTheDocument();
  });

  it('moves focus to the confirm Borrar and restores it to the row Borrar on cancel (P3 #1)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-11');

    await user.click(screen.getByTestId('delete-11'));
    expect(document.activeElement).toBe(screen.getByTestId('confirm-delete-11'));

    await user.click(screen.getByTestId('cancel-delete-11'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('delete-11')));
  });

  it('marks the confirm prompt as an alert and the Cancelar link as muted (P3 #1, #2)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-11');

    await user.click(screen.getByTestId('delete-11'));
    expect(screen.getByRole('alert')).toHaveTextContent('¿Borrar la categoría?');
    expect(screen.getByTestId('cancel-delete-11')).toHaveClass('link muted');
  });

  it('shows the add-category error with role=alert (P3 #4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
    vi.spyOn(api, 'createCategory').mockRejectedValue(new Error('Invalid name'));

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');

    await user.click(screen.getByTestId('cat-add'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nombre inválido.');
  });

  it('shows the deleted-categories fetch error with role=alert and Reintentar reloads (P3 #4, #9)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    const getDeleted = vi.spyOn(api, 'getDeletedCategories').mockRejectedValue(new Error('papelera caída'));

    const user = userEvent.setup();
    render(<CategoriesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('papelera caída');
    await user.click(screen.getByTestId('retry-deleted'));
    await waitFor(() => expect(getDeleted).toHaveBeenCalledTimes(2));
  });

  it('keeps the rename input open with the typed value and shows role=alert when the rename fails (P2)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(tree);
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
    vi.spyOn(api, 'renameCategory').mockRejectedValue(new Error('Name is already taken'));

    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByTestId('delete-1');

    await user.click(screen.getByTestId('rename-btn-1'));
    expect(screen.getByLabelText('Nuevo nombre de Food')).toBeInTheDocument();

    await user.clear(screen.getByTestId('rename-1'));
    await user.type(screen.getByTestId('rename-1'), 'Mercado{Enter}');

    expect(api.renameCategory).toHaveBeenCalledWith(1, 'Mercado');
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is already taken');
    // Edit mode stays open with the typed value so the user can correct it
    expect(screen.getByTestId('rename-1')).toHaveValue('Mercado');
    expect(screen.getByLabelText('Nuevo nombre de Food')).toBeInTheDocument();
  });

  it('shows the page-level load error with role=alert (P2)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockRejectedValue(new Error('backend caído'));
    vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);

    render(<CategoriesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('backend caído');
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

import { useState } from 'react';
import { api, flattenTree } from '../api';
import { useApi } from '../hooks/useApi';
import CategoryTree from '../components/CategoryTree';
import type { CategoryNode } from '../types';

/** Category management page: add (nested), rename, soft-delete and restore (CM-1..5). */
export default function CategoriesPage(): JSX.Element {
  const categories = useApi(() => api.getCategoryTree(), []);
  const deleted = useApi(() => api.getDeletedCategories(), []);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    try {
      await api.createCategory({ name, parentId: parentId === '' ? null : Number(parentId) });
      setName('');
      setParentId('');
      categories.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the category.');
    }
  }

  async function confirmDelete(): Promise<void> {
    if (confirmingId === null) return;
    setDeleteError(null);
    try {
      await api.deleteCategory(confirmingId);
      setConfirmingId(null);
      categories.reload();
      deleted.reload();
    } catch (err) {
      // Keep the prompt open so the user can retry or cancel.
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the category.');
    }
  }

  async function restoreCategory(id: number): Promise<void> {
    setRestoreError(null);
    setRestoringId(id);
    try {
      await api.restoreCategory(id);
      categories.reload();
      deleted.reload();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not restore the category.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <section className="card">
        <h2>Add category</h2>
        <form className="transaction-form" onSubmit={handleAdd} noValidate>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} data-testid="cat-name" />
          </label>
          <label>
            Parent (optional)
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="cat-parent">
              <option value="">Root</option>
              {flattenTree(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit" className="primary" data-testid="cat-add">
              Add
            </button>
          </div>
          {formError && <div className="error-box">{formError}</div>}
        </form>
      </section>
      <section className="card">
        <h2>Categories</h2>
        {categories.error && <div className="error-box">{categories.error}</div>}
        {deleteError && (
          <div className="error-box" role="alert">
            {deleteError}
          </div>
        )}
        {categories.loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <CategoryTree
            categories={categories.data ?? []}
            onRename={async (id, newName) => {
              await api.renameCategory(id, newName);
              categories.reload();
            }}
            onDelete={(id) => setConfirmingId(id)}
            confirmingId={confirmingId}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setConfirmingId(null)}
          />
        )}
      </section>
      {(deleted.data ?? []).length > 0 && (
        <section className="card" data-testid="deleted-section">
          <h2>Deleted categories</h2>
          {deleted.error && <div className="error-box">{deleted.error}</div>}
          {restoreError && (
            <div className="error-box" role="alert">
              {restoreError}
            </div>
          )}
          <ul className="tree">
            {(deleted.data ?? []).map((node: CategoryNode) => (
              <li key={node.id}>
                <span className="tree-row">
                  <span>{node.name}</span>
                  <button
                    className="link"
                    data-testid={`restore-${node.id}`}
                    disabled={restoringId === node.id}
                    onClick={() => void restoreCategory(node.id)}
                  >
                    Restore
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

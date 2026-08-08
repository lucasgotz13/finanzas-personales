import { useState } from 'react';
import { api, flattenTree } from '../api';
import { useApi } from '../hooks/useApi';
import CategoryTree from '../components/CategoryTree';

/** Category management page: add (nested), rename, soft-delete (CM-1..5). */
export default function CategoriesPage(): JSX.Element {
  const categories = useApi(() => api.getCategoryTree(), []);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
        {categories.loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <CategoryTree
            categories={categories.data ?? []}
            onRename={async (id, newName) => {
              await api.renameCategory(id, newName);
              categories.reload();
            }}
            onDelete={async (id) => {
              await api.deleteCategory(id);
              categories.reload();
            }}
          />
        )}
      </section>
    </>
  );
}

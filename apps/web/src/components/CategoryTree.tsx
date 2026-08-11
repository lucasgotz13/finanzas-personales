import { useEffect, useRef, useState } from 'react';
import { translateApiMessage } from '../api';
import type { CategoryNode } from '../types';

export interface CategoryTreeProps {
  categories: CategoryNode[];
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => void;
  confirmingId: number | null;
  onConfirmDelete: () => Promise<void>;
  onCancelDelete: () => void;
}

interface RenameState {
  id: number;
  name: string;
}

/** Nested category tree with rename and soft-delete actions (CM-3, CM-4). */
export default function CategoryTree({
  categories,
  onRename,
  onDelete,
  confirmingId,
  onConfirmDelete,
  onCancelDelete,
}: CategoryTreeProps): JSX.Element {
  const [renaming, setRenaming] = useState<RenameState | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  // Rows' Borrar buttons by id: the prompt replaces the button while open, so
  // cancel restores focus to the re-mounted button via the map (P2/P3 #1).
  const deleteButtonRefs = useRef(new Map<number, HTMLButtonElement | null>());

  // Focus the confirm action when the prompt opens (two-tap stays: focus
  // moves to Borrar, Enter confirms).
  useEffect(() => {
    if (confirmingId !== null) confirmRef.current?.focus();
  }, [confirmingId]);

  function handleCancelDelete(): void {
    const id = confirmingId ?? 0;
    onCancelDelete();
    // The row's Borrar button remounts once the prompt closes; focus it then.
    window.setTimeout(() => deleteButtonRefs.current.get(id)?.focus(), 0);
  }

  async function run(action: () => Promise<void>, id: number): Promise<void> {
    setError(null);
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      setError(translateApiMessage(err instanceof Error ? err.message : 'No se pudo completar la acción.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    await run(onConfirmDelete, confirmingId ?? 0);
  }

  function renderNodes(nodes: CategoryNode[], depth: number): JSX.Element[] {
    return nodes.map((node) => (
      <li key={node.id} style={{ marginLeft: depth * 16 }}>
        <span className="tree-row">
          {renaming?.id === node.id ? (
            <input
              aria-label={`Nuevo nombre de ${node.name}`}
              data-testid={`rename-${node.id}`}
              value={renaming.name}
              onChange={(e) => setRenaming({ id: node.id, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renaming.name.trim() !== '') {
                  // Keep the input open with the typed value until the rename
                  // actually succeeds; on failure the error surfaces in the
                  // error box and the user can correct and retry (P2).
                  void run(async () => {
                    await onRename(node.id, renaming.name.trim());
                    setRenaming(null);
                  }, node.id);
                }
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <>
              <span>{node.name}</span>
              <button className="link" data-testid={`rename-btn-${node.id}`} onClick={() => setRenaming({ id: node.id, name: node.name })}>
                Renombrar
              </button>
            </>
          )}
          {confirmingId === node.id ? (
            <span className="confirm-prompt" role="alert">
              <span className="confirm-question">¿Borrar la categoría?</span>
              <span className="confirm-note">Se puede restaurar más tarde.</span>
              <button
                className="danger"
                data-testid={`confirm-delete-${node.id}`}
                ref={confirmRef}
                disabled={busyId === node.id}
                onClick={() => void handleConfirmDelete()}
              >
                Borrar
              </button>
              <button
                className="link muted"
                data-testid={`cancel-delete-${node.id}`}
                disabled={busyId === node.id}
                onClick={handleCancelDelete}
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              className="danger"
              data-testid={`delete-${node.id}`}
              ref={(el) => {
                deleteButtonRefs.current.set(node.id, el);
              }}
              disabled={busyId === node.id || node.children.length > 0}
              title={node.children.length > 0 ? 'Primero borre sus subcategorías' : undefined}
              onClick={() => onDelete(node.id)}
            >
              Borrar
            </button>
          )}
        </span>
        {node.children.length > 0 && <ul>{renderNodes(node.children, depth + 1)}</ul>}
      </li>
    ));
  }

  return (
    <div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {categories.length === 0 ? <div className="empty">Aún no hay categorías.</div> : <ul className="tree">{renderNodes(categories, 0)}</ul>}
    </div>
  );
}

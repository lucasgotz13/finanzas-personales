import { useState } from 'react';
import { api, translateActionError } from '../api';
import { parseEsArAmount } from '../amount';
import { formatDate } from '../dates';
import { useApi } from '../hooks/useApi';
import type { GoalView } from '../types';
import GoalForm from '../components/GoalForm';

function money(minor: number, currency: 'ARS' | 'USD'): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(minor / 100);
}

function errorText(err: unknown): string {
  return translateActionError(err, 'No se pudo completar la acción.');
}

/** Factual deadline line: days remaining plus the required monthly pace. Never a verdict. */
function deadlineText(goal: GoalView): string {
  const days = goal.daysRemaining as number;
  const pace = money(goal.requiredPaceMinor as number, goal.currency);
  const dayPart =
    days > 1 ? `Faltan ${days} días` : days === 1 ? 'Falta 1 día' : days === 0 ? 'Vence hoy' : `Vencida hace ${-days} ${-days === 1 ? 'día' : 'días'}`;
  return `${dayPart} · Ritmo necesario: ${pace}/mes`;
}

interface GoalCardProps {
  goal: GoalView;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: () => void;
  onMove: (id: number, direction: -1 | 1) => void;
}

/** One goal: derived progress with its automatic/manual trace, manual
 * aporte/retiro controls, priority order buttons and edit/delete. The total
 * itself is never editable — it only moves through surplus and movements. */
function GoalCard({ goal, isFirst, isLast, editing, onEdit, onCancelEdit, onChanged, onMove }: GoalCardProps): JSX.Element {
  const [amount, setAmount] = useState('');
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjBusy, setAdjBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const percent = Math.min(100, Math.round((goal.totalMinor / goal.targetMinor) * 100));

  async function adjust(kind: 'aporte' | 'retiro'): Promise<void> {
    const parsed = parseEsArAmount(amount);
    if (parsed === null || parsed <= 0) {
      setAdjError('El monto debe ser un número positivo.');
      return;
    }
    setAdjError(null);
    setAdjBusy(true);
    try {
      await api.addGoalAdjustment(goal.id, { kind, amountMinor: Math.round(parsed * 100) });
      setAmount('');
      onChanged();
    } catch (err) {
      setAdjError(errorText(err));
    } finally {
      setAdjBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    try {
      await api.deleteGoal(goal.id);
      onChanged();
    } catch (err) {
      setDeleteError(errorText(err));
    }
  }

  return (
    <article className="card goal-card" data-testid={`goal-${goal.id}`}>
      <div className="indicators-header">
        <h3>{goal.name}</h3>
        <span className="badge ok">{goal.currency}</span>
        {goal.completed && (
          <span className="badge ok" data-testid={`goal-completed-${goal.id}`}>
            Completada
          </span>
        )}
      </div>
      <p className="money" data-testid={`goal-progress-${goal.id}`}>
        {money(goal.totalMinor, goal.currency)} de {money(goal.targetMinor, goal.currency)} ({percent}%)
      </p>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p data-testid={`goal-split-${goal.id}`}>
        Automático: {money(goal.automaticMinor, goal.currency)} · Manual: {money(goal.manualNetMinor, goal.currency)}
      </p>
      {goal.deadline !== null && (
        <p data-testid={`goal-deadline-${goal.id}`}>
          Límite: {formatDate(goal.deadline)} · {deadlineText(goal)}
        </p>
      )}
      <div className="transaction-form">
        <label>
          Monto ({goal.currency})
          <input
            type="text"
            inputMode="decimal"
            placeholder="10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid={`goal-amount-${goal.id}`}
          />
        </label>
        <div className="actions">
          <button type="button" className="primary" disabled={adjBusy} onClick={() => void adjust('aporte')} data-testid={`goal-aporte-${goal.id}`}>
            Aportar
          </button>
          <button type="button" className="warning" disabled={adjBusy} onClick={() => void adjust('retiro')} data-testid={`goal-retiro-${goal.id}`}>
            Retirar
          </button>
        </div>
        {adjError && (
          <div className="error-box" role="alert">
            {adjError}
          </div>
        )}
      </div>
      <div className="row-actions actions-cell">
        <button
          type="button"
          className="link muted"
          disabled={isFirst}
          aria-label={`Subir prioridad de ${goal.name}`}
          onClick={() => onMove(goal.id, -1)}
          data-testid={`goal-up-${goal.id}`}
        >
          Subir
        </button>
        <button
          type="button"
          className="link muted"
          disabled={isLast}
          aria-label={`Bajar prioridad de ${goal.name}`}
          onClick={() => onMove(goal.id, 1)}
          data-testid={`goal-down-${goal.id}`}
        >
          Bajar
        </button>
        <button type="button" className="link muted" onClick={onEdit} data-testid={`goal-edit-${goal.id}`}>
          Editar
        </button>
        {confirmingDelete ? (
          <span className="confirm-prompt" role="alert">
            <span className="confirm-question">¿Borrar la meta?</span>
            <button type="button" className="danger" onClick={() => void confirmDelete()} data-testid={`goal-confirm-delete-${goal.id}`}>
              Borrar
            </button>
            <button type="button" className="link muted" onClick={() => setConfirmingDelete(false)} data-testid={`goal-cancel-delete-${goal.id}`}>
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmingDelete(true)} data-testid={`goal-delete-${goal.id}`}>
            Borrar
          </button>
        )}
      </div>
      {deleteError && <div className="error-box" role="alert">{deleteError}</div>}
      {editing && (
        <GoalForm
          key={`edit-${goal.id}`}
          initial={goal}
          onSaved={() => {
            onCancelEdit();
            onChanged();
          }}
          onCancel={onCancelEdit}
        />
      )}
    </article>
  );
}

/** "Metas" tab: savings goals funded by the per-currency monthly surplus
 * (same surplus as Resúmenes) plus manual aportes/retiros. `active` gates
 * the fetch on the tab being open. */
export default function GoalsPage({ active = true }: { active?: boolean }): JSX.Element {
  const [tick, setTick] = useState(0);
  const goals = useApi(() => api.listGoals(), [tick], active);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const reload = (): void => setTick((t) => t + 1);

  async function handleMove(id: number, direction: -1 | 1): Promise<void> {
    const list = goals.data ?? [];
    const idx = list.findIndex((g) => g.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const ids = list.map((g) => g.id);
    const tmp = ids[idx] as number;
    ids[idx] = ids[swap] as number;
    ids[swap] = tmp;
    try {
      await api.reorderGoals(ids);
      setMoveError(null);
      reload();
    } catch (err) {
      setMoveError(errorText(err));
    }
  }

  return (
    <>
      <section className="card">
        <h2>Nueva meta</h2>
        <GoalForm key="create" onSaved={() => reload()} />
      </section>
      <section>
        <h2>Mis metas</h2>
        {goals.error && (
          <div className="error-box" role="alert">
            {goals.error}{' '}
            <button type="button" className="link" data-testid="retry-goals" onClick={() => goals.reload()}>
              Reintentar
            </button>
          </div>
        )}
        {moveError && (
          <div className="error-box" role="alert" data-testid="move-error">
            {moveError}
          </div>
        )}
        {goals.loading && goals.data === null ? (
          <div className="empty">Cargando…</div>
        ) : (goals.data ?? []).length === 0 ? (
          !goals.error && (
            <div className="empty" data-testid="goals-empty">
              Aún no hay metas — creá la primera con el formulario.
            </div>
          )
        ) : (
          (goals.data ?? []).map((goal, i, list) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isFirst={i === 0}
              isLast={i === list.length - 1}
              editing={editingId === goal.id}
              onEdit={() => setEditingId(goal.id)}
              onCancelEdit={() => setEditingId(null)}
              onChanged={reload}
              onMove={(id, direction) => void handleMove(id, direction)}
            />
          ))
        )}
      </section>
    </>
  );
}

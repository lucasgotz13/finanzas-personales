import { useEffect, useRef, useState } from 'react';
import { api, translateActionError } from '../api';
import { parseEsArAmount } from '../amount';
import { formatDate } from '../dates';
import { useApi } from '../hooks/useApi';
import type { GoalAdjustment, GoalView } from '../types';
import GoalForm from '../components/GoalForm';

function money(minor: number, currency: 'ARS' | 'USD'): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(minor / 100);
}

function errorText(err: unknown): string {
  return translateActionError(err, 'No se pudo completar la acción.');
}

/** Factual day count for the deadline line. Overdue says how late it is; the
 * state word (VENCIDA) lives in the chip, never duplicated here. */
function deadlineDays(goal: GoalView): string {
  const days = goal.daysRemaining as number;
  return days > 1 ? `Faltan ${days} días` : days === 1 ? 'Falta 1 día' : days === 0 ? 'Vence hoy' : `Hace ${-days} ${-days === 1 ? 'día' : 'días'}`;
}

/** Required monthly pace for the deadline line: a fact, never a verdict. */
function deadlinePace(goal: GoalView): string {
  return `Ritmo necesario: ${money(goal.requiredPaceMinor as number, goal.currency)}/mes`;
}

interface GoalCardProps {
  goal: GoalView;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  /** Reorder failure for this card only: the notice belongs where the move started. */
  moveError: string | null;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: () => void;
  onMove: (id: number, direction: -1 | 1) => void;
}

/** One goal: derived progress with its automatic/manual trace, manual
 * aporte/retiro controls, priority order buttons and edit/delete. The total
 * itself is never editable — it only moves through surplus and movements. */
function GoalCard({ goal, isFirst, isLast, editing, moveError, onEdit, onCancelEdit, onChanged, onMove }: GoalCardProps): JSX.Element {
  const [amount, setAmount] = useState('');
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjBusy, setAdjBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Reschedule flow: open the edit form with the deadline field focused.
  const [focusDeadline, setFocusDeadline] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movements, setMovements] = useState<GoalAdjustment[] | null>(null);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  // The trigger unmounts while the prompt is open, so remember that the prompt
  // was actually shown before sending focus back to the re-mounted button.
  const wasConfirmingDeleteRef = useRef(false);

  const overdue = goal.deadline !== null && (goal.daysRemaining as number) < 0;

  // Focus choreography: opening the prompt lands on its Borrar; cancelling
  // (Cancelar or Escape) returns focus to the trigger that opened it.
  useEffect(() => {
    if (confirmingDelete) {
      wasConfirmingDeleteRef.current = true;
      confirmDeleteRef.current?.focus();
      return;
    }
    if (wasConfirmingDeleteRef.current) {
      wasConfirmingDeleteRef.current = false;
      deleteTriggerRef.current?.focus();
    }
  }, [confirmingDelete]);

  // The money sub shows the real funded percent (it can exceed 100); only the
  // bar width saturates at 100.
  const percent = Math.round((goal.totalMinor / goal.targetMinor) * 100);
  const barPercent = Math.max(0, Math.min(100, percent));

  async function loadMovements(): Promise<void> {
    setMovementsLoading(true);
    setMovementsError(null);
    try {
      setMovements(await api.listGoalAdjustments(goal.id));
    } catch (err) {
      setMovementsError(errorText(err));
    } finally {
      setMovementsLoading(false);
    }
  }

  async function toggleMovements(): Promise<void> {
    if (movementsOpen) {
      setMovementsOpen(false);
      return;
    }
    setMovementsOpen(true);
    await loadMovements();
  }

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
      // The open history is part of what the movement just changed.
      if (movementsOpen) await loadMovements();
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

  function cancelDelete(): void {
    // The effect above restores focus to the re-mounted trigger.
    setConfirmingDelete(false);
  }

  return (
    <article className="card goal-card" data-testid={`goal-${goal.id}`}>
      <div className="indicators-header">
        <h3>{goal.name}</h3>
        <span className="goal-currency" data-testid={`goal-currency-${goal.id}`}>
          {goal.currency}
        </span>
        {goal.completed && (
          <span className="badge ok" data-testid={`goal-completed-${goal.id}`}>
            Completada
          </span>
        )}
      </div>
      <p className="goal-money" data-testid={`goal-progress-${goal.id}`}>
        <span className="goal-money-total">{money(goal.totalMinor, goal.currency)}</span>{' '}
        <span className="goal-money-sub">de {money(goal.targetMinor, goal.currency)} ({percent}%)</span>
      </p>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${barPercent}%` }} />
      </div>
      <p className="goal-meta" data-testid={`goal-split-${goal.id}`}>
        Automático: {money(goal.automaticMinor, goal.currency)} · Manual: {money(goal.manualNetMinor, goal.currency)}
      </p>
      {goal.deadline !== null && (
        <p className="goal-meta goal-deadline" data-testid={`goal-deadline-${goal.id}`}>
          Límite: {formatDate(goal.deadline)}
          {overdue && (
            <>
              {' '}
              <span className="badge over" data-testid={`goal-overdue-${goal.id}`}>
                Vencida
              </span>
            </>
          )}
          {' · '}
          <span className={overdue ? 'goal-overdue-days' : undefined}>{deadlineDays(goal)}</span>
          {' · '}
          {deadlinePace(goal)}
          {overdue && (
            <>
              {' · '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setFocusDeadline(true);
                  onEdit();
                }}
                data-testid={`goal-reschedule-${goal.id}`}
              >
                Reprogramar plazo
              </button>
            </>
          )}
        </p>
      )}
      <div className="transaction-form">
        <label>
          Monto ({goal.currency})
          <input
            type="text"
            inputMode="decimal"
            placeholder="10.000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={adjError !== null ? true : undefined}
            aria-describedby={adjError !== null ? `goal-adj-error-${goal.id}` : undefined}
            data-testid={`goal-amount-${goal.id}`}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={adjBusy || goal.completed}
            onClick={() => void adjust('aporte')}
            data-testid={`goal-aporte-${goal.id}`}
          >
            Aportar
          </button>
          <button type="button" className="warning" disabled={adjBusy} onClick={() => void adjust('retiro')} data-testid={`goal-retiro-${goal.id}`}>
            Retirar
          </button>
        </div>
        {adjError && (
          <div className="error-box" role="alert" id={`goal-adj-error-${goal.id}`}>
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
        <button
          type="button"
          className="link muted"
          onClick={() => {
            setFocusDeadline(false);
            onEdit();
          }}
          data-testid={`goal-edit-${goal.id}`}
        >
          Editar
        </button>
        <button
          type="button"
          className="link muted"
          aria-expanded={movementsOpen}
          onClick={() => void toggleMovements()}
          data-testid={`goal-movements-${goal.id}`}
        >
          {movementsOpen ? 'Ocultar movimientos' : 'Ver movimientos'}
        </button>
        {confirmingDelete ? (
          <span
            className="confirm-prompt"
            role="alert"
            onKeyDown={(e) => {
              // Escape belongs to the open prompt: cancel instead of letting
              // the key bubble to any outer surface.
              if (e.key === 'Escape') {
                e.stopPropagation();
                cancelDelete();
              }
            }}
          >
            <span className="confirm-question">¿Borrar la meta?</span>
            <span className="confirm-note">Se borrarán también los aportes registrados.</span>
            <button
              type="button"
              className="danger"
              ref={confirmDeleteRef}
              onClick={() => void confirmDelete()}
              data-testid={`goal-confirm-delete-${goal.id}`}
            >
              Borrar
            </button>
            <button type="button" className="link muted" onClick={cancelDelete} data-testid={`goal-cancel-delete-${goal.id}`}>
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="danger"
            ref={deleteTriggerRef}
            onClick={() => setConfirmingDelete(true)}
            data-testid={`goal-delete-${goal.id}`}
          >
            Borrar
          </button>
        )}
      </div>
      {moveError && (
        <div className="error-box" role="alert" data-testid={`move-error-${goal.id}`}>
          {moveError}
        </div>
      )}
      {movementsOpen && (
        <div className="goal-movements">
          {movementsLoading ? (
            <p className="empty">Cargando…</p>
          ) : movementsError ? (
            <div className="error-box" role="alert">
              {movementsError}
            </div>
          ) : (movements ?? []).length === 0 ? (
            <p className="empty">Sin movimientos manuales.</p>
          ) : (
            (movements ?? []).map((adj) => (
              <p className="goal-movement" key={adj.id}>
                <span className="goal-movement-date">{formatDate(adj.createdAt)}</span> ·{' '}
                {adj.amountMinor > 0 ? 'Aporte' : 'Retiro'}{' '}
                <span className="goal-movement-amount">{money(Math.abs(adj.amountMinor), goal.currency)}</span>
              </p>
            ))
          )}
        </div>
      )}
      {deleteError && <div className="error-box" role="alert">{deleteError}</div>}
      {editing && (
        <GoalForm
          key={`edit-${goal.id}`}
          initial={goal}
          focusDeadline={focusDeadline}
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
  // A reorder failure belongs to the card whose Subir/Bajar started it.
  const [moveError, setMoveError] = useState<{ goalId: number; message: string } | null>(null);
  // null = no explicit user choice yet: the disclosure defaults open only when
  // the loaded list is empty, closed when there are goals to show first.
  const [creating, setCreating] = useState<boolean | null>(null);

  const loaded = goals.data !== null;
  const isEmpty = loaded && (goals.data ?? []).length === 0;
  const formOpen = creating ?? isEmpty;

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
    // A new move supersedes the previous failure notice.
    setMoveError(null);
    try {
      await api.reorderGoals(ids);
      setMoveError(null);
      reload();
    } catch (err) {
      setMoveError({ goalId: id, message: errorText(err) });
    }
  }

  return (
    <>
      <section>
        <div className="goal-list-header">
          <h2>Mis metas</h2>
          <button
            type="button"
            className={formOpen ? 'link muted' : 'link'}
            aria-expanded={formOpen}
            aria-controls="goal-create-form"
            data-testid="goal-create-toggle"
            onClick={() => setCreating(!formOpen)}
          >
            {formOpen ? 'Cancelar' : '+ Nueva meta'}
          </button>
        </div>
        {/* The funding engine, stated once: automatic surplus vs manual movements. */}
        <p className="goal-explainer">Automático: el excedente mensual repartido por prioridad · Manual: tus aportes y retiros.</p>
        {formOpen && (
          <div className="card" id="goal-create-form">
            <GoalForm
              key="create"
              onSaved={() => {
                setCreating(false);
                reload();
              }}
            />
          </div>
        )}
        {goals.error && (
          <div className="error-box" role="alert">
            {goals.error}{' '}
            <button type="button" className="link" data-testid="retry-goals" onClick={() => goals.reload()}>
              Reintentar
            </button>
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
              moveError={moveError?.goalId === goal.id ? moveError.message : null}
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

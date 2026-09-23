import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { GoalView } from '../../types';
import GoalsPage from '../GoalsPage';

const goalA: GoalView = {
  id: 1,
  name: 'Viaje',
  targetMinor: 100000,
  currency: 'ARS',
  deadline: '2026-10-15',
  createdAt: '2026-08-01T12:00:00.000Z',
  priority: 0,
  completed: false,
  automaticMinor: 30000,
  manualAportesMinor: 10000,
  manualRetirosMinor: 0,
  manualNetMinor: 10000,
  totalMinor: 40000,
  remainingMinor: 60000,
  daysRemaining: 68,
  requiredPaceMinor: 20000,
};

const goalB: GoalView = {
  id: 2,
  name: 'Fondo',
  targetMinor: 50000,
  currency: 'ARS',
  deadline: null,
  createdAt: '2026-08-02T12:00:00.000Z',
  priority: 1,
  completed: true,
  automaticMinor: 40000,
  manualAportesMinor: 10000,
  manualRetirosMinor: 0,
  manualNetMinor: 10000,
  totalMinor: 50000,
  remainingMinor: 0,
  daysRemaining: null,
  requiredPaceMinor: null,
};

const goalOverdue: GoalView = {
  ...goalA,
  id: 3,
  deadline: '2026-09-15',
  daysRemaining: -8,
  requiredPaceMinor: 68000000,
};

const goalOverFunded: GoalView = {
  ...goalA,
  id: 4,
  completed: true,
  automaticMinor: 80000,
  manualNetMinor: 28000,
  totalMinor: 108000,
  remainingMinor: 0,
};

function mockList(goals: GoalView[] = [goalA, goalB]): void {
  vi.spyOn(api, 'listGoals').mockResolvedValue(goals);
}

describe('GoalsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders progress, the automatic/manual trace, the Completada badge and the deadline pace', async () => {
    mockList();
    render(<GoalsPage />);

    expect(await screen.findByTestId('goal-1')).toBeInTheDocument();
    // Progress with es-AR amounts and percent.
    expect(screen.getByTestId('goal-progress-1')).toHaveTextContent('$ 400,00 de $ 1.000,00 (40%)');
    // Visible trace: how much was automatic vs manual.
    expect(screen.getByTestId('goal-split-1')).toHaveTextContent('Automático: $ 300,00 · Manual: $ 100,00');
    // Deadline: days remaining + required pace, no verdict anywhere.
    expect(screen.getByTestId('goal-deadline-1')).toHaveTextContent(
      'Límite: 15/10/2026 · Faltan 68 días · Ritmo necesario: $ 200,00/mes',
    );
    // Byte-identical raw text: same characters as before the overdue chip
    // (including the NBSP that Intl puts inside the formatted amount).
    expect(screen.getByTestId('goal-deadline-1').textContent).toBe(
      'Límite: 15/10/2026 · Faltan 68 días · Ritmo necesario: $\u00a0200,00/mes',
    );
    expect(screen.queryByText(/vas bien|vas mal/i)).not.toBeInTheDocument();
    // Completed goal stays listed with its badge; goals without deadline show no pace line.
    expect(screen.getByTestId('goal-completed-2')).toHaveTextContent('Completada');
    expect(screen.queryByTestId('goal-deadline-2')).not.toBeInTheDocument();
  });

  it('shouts an overdue goal with a Vencida chip, danger days and a reschedule link', async () => {
    mockList([goalOverdue]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-3');

    // The state word lives in the chip, not inside the muted meta sentence.
    expect(screen.getByTestId('goal-overdue-3')).toHaveTextContent('Vencida');
    expect(screen.getByTestId('goal-deadline-3')).toHaveTextContent('Límite: 15/09/2026');
    expect(screen.getByTestId('goal-deadline-3')).toHaveTextContent('Ritmo necesario: $ 680.000,00/mes');

    // The day count carries the danger styling inside the meta line.
    const days = screen.getByText('Hace 8 días');
    expect(days).toHaveClass('goal-overdue-days');

    // The currency is a label now: Completada stays the only chip on the card.
    const currency = screen.getByTestId('goal-currency-3');
    expect(currency).toHaveTextContent('ARS');
    expect(currency).not.toHaveClass('badge');

    // Reschedule opens the edit form with the deadline field focused.
    await user.click(screen.getByTestId('goal-reschedule-3'));
    const card = screen.getByTestId('goal-3');
    const deadlineInput = within(card).getByTestId('goal-deadline');
    expect(deadlineInput).toHaveValue('2026-09-15');
    expect(document.activeElement).toBe(deadlineInput);
  });

  it('renders the empty state when there are no goals', async () => {
    mockList([]);
    render(<GoalsPage />);
    expect(await screen.findByTestId('goals-empty')).toHaveTextContent('Aún no hay metas');
  });

  it('keeps the create form behind the disclosure when there are goals', async () => {
    mockList();
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    // Goals exist: the list leads and the form stays closed behind the toggle.
    expect(screen.queryByTestId('goal-name')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('goal-create-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(await screen.findByTestId('goal-name')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.queryByTestId('goal-name')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('replaces the fetch error with the goals list after a successful retry', async () => {
    const listGoals = vi.spyOn(api, 'listGoals').mockRejectedValueOnce(new Error('metas caídas')).mockResolvedValue([goalA, goalB]);
    const user = userEvent.setup();
    render(<GoalsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('metas caídas');
    expect(screen.queryByTestId('goals-empty')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('retry-goals'));
    expect(await screen.findByTestId('goal-1')).toBeInTheDocument();
    expect(screen.getByTestId('goal-1')).toHaveTextContent('Viaje');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listGoals).toHaveBeenCalledTimes(2);
  });

  it('creates a goal through the API with minor units (es-AR decimal comma)', async () => {
    mockList([]);
    const createGoal = vi.spyOn(api, 'createGoal').mockResolvedValue(goalA);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.type(screen.getByTestId('goal-name'), 'Viaje');
    await user.type(screen.getByTestId('goal-target'), '1000,50');
    await user.click(screen.getByTestId('goal-submit'));

    expect(createGoal).toHaveBeenCalledWith({ name: 'Viaje', targetMinor: 100050, currency: 'ARS', deadline: null });
  });

  it('rejects an empty create with a validation error and does not call the API', async () => {
    mockList([]);
    const createGoal = vi.spyOn(api, 'createGoal').mockResolvedValue(goalA);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.click(screen.getByTestId('goal-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('El nombre es obligatorio.');
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('marks the invalid fields, focuses the first one and points them at the error box', async () => {
    mockList([]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.click(screen.getByTestId('goal-submit'));

    const errorBox = await screen.findByRole('alert');
    expect(errorBox).toHaveAttribute('id', 'goal-form-errors');
    const nameInput = screen.getByTestId('goal-name');
    const targetInput = screen.getByTestId('goal-target');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'goal-form-errors');
    expect(targetInput).toHaveAttribute('aria-invalid', 'true');
    expect(targetInput).toHaveAttribute('aria-describedby', 'goal-form-errors');
    expect(document.activeElement).toBe(nameInput);

    // Fixing the name leaves only the target marked; focus lands there next.
    await user.type(nameInput, 'Viaje');
    await user.click(screen.getByTestId('goal-submit'));
    expect(targetInput).toHaveAttribute('aria-invalid', 'true');
    expect(targetInput).toHaveAttribute('aria-describedby', 'goal-form-errors');
    expect(nameInput).not.toHaveAttribute('aria-invalid');
    expect(document.activeElement).toBe(targetInput);
  });

  it('leaves the fields unmarked for an API error', async () => {
    mockList([]);
    vi.spyOn(api, 'createGoal').mockRejectedValue(new Error('sin conexión'));
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.type(screen.getByTestId('goal-name'), 'Viaje');
    await user.type(screen.getByTestId('goal-target'), '1000');
    await user.click(screen.getByTestId('goal-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión');
    expect(screen.getByTestId('goal-name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByTestId('goal-target')).not.toHaveAttribute('aria-invalid');
  });

  it('registers an aporte with the goal amount and reloads the list', async () => {
    mockList();
    const adjust = vi.spyOn(api, 'addGoalAdjustment').mockResolvedValue({ id: 7, goalId: 1, amountMinor: 50000, createdAt: '' });
    const listGoals = vi.spyOn(api, 'listGoals').mockResolvedValue([goalA, goalB]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.type(screen.getByTestId('goal-amount-1'), '500');
    await user.click(screen.getByTestId('goal-aporte-1'));

    expect(adjust).toHaveBeenCalledWith(1, { kind: 'aporte', amountMinor: 50000 });
    await waitFor(() => expect(listGoals).toHaveBeenCalledTimes(2));
  });

  it('registers a retiro and rejects a non-positive amount without calling the API', async () => {
    mockList();
    const adjust = vi.spyOn(api, 'addGoalAdjustment').mockResolvedValue({ id: 8, goalId: 1, amountMinor: -1000, createdAt: '' });
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-retiro-1'));
    const alertBox = await screen.findByRole('alert');
    expect(alertBox).toHaveTextContent('El monto debe ser un número positivo.');
    const amountInput = screen.getByTestId('goal-amount-1');
    expect(alertBox).toHaveAttribute('id', 'goal-adj-error-1');
    expect(amountInput).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput).toHaveAttribute('aria-describedby', 'goal-adj-error-1');
    expect(adjust).not.toHaveBeenCalled();

    await user.type(amountInput, '10');
    await user.click(screen.getByTestId('goal-retiro-1'));
    expect(adjust).toHaveBeenCalledWith(1, { kind: 'retiro', amountMinor: 1000 });
    // A successful movement clears the field flags along with the message.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(amountInput).not.toHaveAttribute('aria-invalid');
  });

  it('reorders with Subir/Bajar by sending the swapped id array', async () => {
    mockList();
    const reorder = vi.spyOn(api, 'reorderGoals').mockResolvedValue([goalB, goalA]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    // First goal cannot go up; lowering it swaps the two ids.
    expect(screen.getByTestId('goal-up-1')).toBeDisabled();
    await user.click(screen.getByTestId('goal-down-1'));
    expect(reorder).toHaveBeenCalledWith([2, 1]);
  });

  it('shows a failed reorder inside the affected card, not above the list', async () => {
    mockList();
    vi.spyOn(api, 'reorderGoals').mockRejectedValue(new Error('orden caído'));
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-down-1'));

    const card = screen.getByTestId('goal-1');
    const error = await within(card).findByTestId('move-error-1');
    expect(error).toHaveTextContent('orden caído');
    expect(error).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('move-error')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('goal-2')).queryByTestId('move-error-2')).not.toBeInTheDocument();

    // The next move clears the stale notice and pins the new one to its card.
    await user.click(screen.getByTestId('goal-up-2'));
    expect(await within(screen.getByTestId('goal-2')).findByTestId('move-error-2')).toHaveTextContent('orden caído');
    expect(screen.queryByTestId('move-error-1')).not.toBeInTheDocument();
  });

  it('edits a goal name through the inline form', async () => {
    mockList();
    const updateGoal = vi.spyOn(api, 'updateGoal').mockResolvedValue({ ...goalA, name: 'Viaje 2027' });
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-edit-1'));
    const card = screen.getByTestId('goal-1');
    const nameInput = within(card).getByTestId('goal-name');
    expect(nameInput).toHaveValue('Viaje');
    await user.clear(nameInput);
    await user.type(nameInput, 'Viaje 2027');
    await user.click(within(card).getByTestId('goal-submit'));

    expect(updateGoal).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Viaje 2027', targetMinor: 100000, currency: 'ARS', deadline: '2026-10-15' }),
    );
  });

  it('deletes a goal only after confirming', async () => {
    mockList();
    const deleteGoal = vi.spyOn(api, 'deleteGoal').mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-delete-1'));
    expect(deleteGoal).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('goal-confirm-delete-1'));
    expect(deleteGoal).toHaveBeenCalledWith(1);
  });

  it('states the delete consequence, focuses the confirm button and cancels on Escape', async () => {
    mockList();
    const deleteGoal = vi.spyOn(api, 'deleteGoal').mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-delete-1'));

    const prompt = screen.getByRole('alert');
    expect(prompt).toHaveTextContent('¿Borrar la meta?');
    expect(prompt).toHaveTextContent('Se borrarán también los aportes registrados.');
    expect(document.activeElement).toBe(screen.getByTestId('goal-confirm-delete-1'));

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('goal-confirm-delete-1')).not.toBeInTheDocument();
    expect(screen.queryByText('¿Borrar la meta?')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('goal-delete-1'));
    expect(deleteGoal).not.toHaveBeenCalled();
  });

  it('states the funding engine once under the list header', async () => {
    mockList();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');
    expect(
      screen.getByText('Automático: el excedente mensual repartido por prioridad · Manual: tus aportes y retiros.'),
    ).toBeInTheDocument();
  });

  it('disables Aportar on a completed goal', async () => {
    mockList();
    render(<GoalsPage />);
    await screen.findByTestId('goal-2');
    expect(screen.getByTestId('goal-aporte-2')).toBeDisabled();
    expect(screen.getByTestId('goal-aporte-1')).toBeEnabled();
  });

  it('shows the real funded percent when the money exceeds the target and caps only the bar', async () => {
    mockList([goalOverFunded]);
    render(<GoalsPage />);
    expect(await screen.findByTestId('goal-progress-4')).toHaveTextContent('de $ 1.000,00 (108%)');
    expect(screen.getByTestId('goal-4').querySelector('.progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('opens the movement history with newest-first aportes and retiros', async () => {
    mockList([goalA]);
    vi.spyOn(api, 'listGoalAdjustments').mockResolvedValue([
      { id: 12, goalId: 1, amountMinor: 10000, createdAt: '2026-08-10T12:00:00.000Z' },
      { id: 11, goalId: 1, amountMinor: -3000, createdAt: '2026-08-08T12:00:00.000Z' },
    ]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    const toggle = screen.getByTestId('goal-movements-1');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Ver movimientos');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Ocultar movimientos');

    const rows = await waitFor(() => {
      const found = screen.getByTestId('goal-1').querySelectorAll('.goal-movement');
      expect(found).toHaveLength(2);
      return found;
    });
    expect(rows[0]).toHaveTextContent('10/08/2026 · Aporte $ 100,00');
    expect(rows[1]).toHaveTextContent('08/08/2026 · Retiro $ 30,00');
  });

  it('refetches the open movement history after a movement', async () => {
    mockList([goalA]);
    const listAdjustments = vi.spyOn(api, 'listGoalAdjustments').mockResolvedValue([]);
    vi.spyOn(api, 'addGoalAdjustment').mockResolvedValue({
      id: 13,
      goalId: 1,
      amountMinor: 50000,
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-movements-1'));
    expect(await screen.findByText('Sin movimientos manuales.')).toBeInTheDocument();

    await user.type(screen.getByTestId('goal-amount-1'), '500');
    await user.click(screen.getByTestId('goal-aporte-1'));
    await waitFor(() => expect(listAdjustments).toHaveBeenCalledTimes(2));
  });

  it('shows the movement history error in an alert box', async () => {
    mockList([goalA]);
    vi.spyOn(api, 'listGoalAdjustments').mockRejectedValue(new Error('movimientos caídos'));
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-movements-1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('movimientos caídos');
  });
});

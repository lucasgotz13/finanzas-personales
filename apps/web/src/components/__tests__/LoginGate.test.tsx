import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../../api';
import LoginGate from '../LoginGate';

describe('LoginGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the form with neutral es-AR copy and focuses the passphrase field', () => {
    render(<LoginGate onSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByText('Acceso con contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: 'Seguir conectado' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('submits the passphrase with the remember flag and calls onSuccess', async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(api, 'login').mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<LoginGate onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Contraseña'), 'clave-secreta');
    await user.click(screen.getByRole('checkbox', { name: 'Seguir conectado' }));
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('clave-secreta', true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows the es-AR translation when the passphrase is rejected', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid passphrase'));
    render(<LoginGate onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta.');
    expect(screen.getByTestId('login-submit')).not.toBeDisabled();
  });

  it('translates the lockout detail with the remaining seconds', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Too many failed attempts', ['too many failed attempts; try again in 42s']),
    );
    render(<LoginGate onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos fallidos; espere 42 segundos.');
  });

  it('disables the submit button while the login request is pending', () => {
    vi.spyOn(api, 'login').mockReturnValue(new Promise(() => {}));
    render(<LoginGate onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
  });

  it('validates an empty passphrase without calling the API', async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(api, 'login').mockResolvedValue(undefined);
    render(<LoginGate onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingrese su contraseña.');
    expect(login).not.toHaveBeenCalled();
  });
});

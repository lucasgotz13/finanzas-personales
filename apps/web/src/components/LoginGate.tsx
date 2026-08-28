import { useEffect, useRef, useState } from 'react';
import { ApiError, api, translateApiError, translateApiMessage } from '../api';

export interface LoginGateProps {
  /** Fired after a successful login; the App shell flips to the authed UI. */
  onSuccess: () => void;
}

/** Login screen (WU2): passphrase + remember checkbox on the warm paper. */
export default function LoginGate({ onSuccess }: LoginGateProps): JSX.Element {
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passphraseRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passphraseRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (passphrase.trim() === '') {
      setError('Ingrese su contraseña.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.login(passphrase, remember);
      onSuccess();
    } catch (err) {
      // Structured reason first (lockout seconds, wrong passphrase), then the
      // legacy message table, then the raw message.
      setError(
        err instanceof ApiError
          ? translateApiError(err)
          : translateApiMessage(err instanceof Error ? err.message : 'No se pudo iniciar sesión.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-gate">
      <div className="card">
        <span className="folder-label">Finanzas Personales</span>
        <h1>Ingresar</h1>
        <p className="login-subtitle">Acceso con contraseña</p>
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-passphrase">Contraseña</label>
          <input
            id="login-passphrase"
            ref={passphraseRef}
            type="password"
            autoComplete="current-password"
            required
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            data-testid="login-passphrase"
          />
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              data-testid="login-remember"
            />
            Seguir conectado
          </label>
          <button type="submit" className="primary" disabled={submitting} data-testid="login-submit">
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          {error !== null && (
            <div className="error-box" role="alert" data-testid="login-error">
              {error}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

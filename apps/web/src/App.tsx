import { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import LoginGate from './components/LoginGate';
import ThemeToggle from './components/ThemeToggle';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import IndicatorsPage from './pages/IndicatorsPage';
import InvestmentsPage from './pages/InvestmentsPage';
import SummariesPage from './pages/SummariesPage';
import TransactionsPage from './pages/TransactionsPage';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries' | 'indicators' | 'inversiones';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transacciones' },
  { id: 'categories', label: 'Categorías' },
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'summaries', label: 'Resúmenes' },
  { id: 'indicators', label: 'Indicadores' },
  { id: 'inversiones', label: 'Inversiones' },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('transactions');
  // null = checking the session on first paint (WU2).
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .authStatus()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  // Any unexpected 401 on a data call drops the session back to the gate.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  async function handleLogout(): Promise<void> {
    try {
      await api.logout();
    } finally {
      setAuthed(false);
    }
  }

  if (authed === null) {
    return (
      <main className="login-gate">
        <div className="card" data-testid="auth-loading">
          Cargando…
        </div>
      </main>
    );
  }

  if (authed === false) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }

  const tabButtons = TABS.map((t) => (
    <button
      key={t.id}
      role="tab"
      aria-selected={tab === t.id}
      className={tab === t.id ? 'active' : ''}
      onClick={() => setTab(t.id)}
    >
      {t.label}
    </button>
  ));
  return (
    <>
      <header className="app-header">
        <h1>Finanzas Personales</h1>
        <ThemeToggle />
        {/* Desktop tabs; hidden on mobile where the bottom bar takes over. */}
        <nav className="tabs desktop-tabs" role="tablist" aria-label="Secciones">
          {tabButtons}
        </nav>
        <button type="button" className="link muted logout-button" onClick={() => void handleLogout()} data-testid="logout">
          Salir
        </button>
      </header>
      <main>
        <div className={tab === 'transactions' ? 'tab-panel' : 'tab-panel hidden'}>
          <TransactionsPage />
        </div>
        <div className={tab === 'categories' ? 'tab-panel' : 'tab-panel hidden'}>
          <CategoriesPage />
        </div>
        <div className={tab === 'budgets' ? 'tab-panel' : 'tab-panel hidden'}>
          <BudgetsPage />
        </div>
        <div className={tab === 'summaries' ? 'tab-panel' : 'tab-panel hidden'}>
          <SummariesPage />
        </div>
        <div className={tab === 'indicators' ? 'tab-panel' : 'tab-panel hidden'}>
          <IndicatorsPage />
        </div>
        <div className={tab === 'inversiones' ? 'tab-panel' : 'tab-panel hidden'}>
          <InvestmentsPage />
        </div>
      </main>
      {/* Mobile-first navigation: thumb-reachable, same buttons and state as
          the header tabs (CSS swaps them at the ≤640px breakpoint). */}
      <nav className="bottom-bar mobile-only" role="tablist" aria-label="Secciones">
        {tabButtons}
      </nav>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
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

type TablistPrefix = 'd' | 'm';

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('transactions');
  // null = checking the session on first paint (WU2).
  const [authed, setAuthed] = useState<boolean | null>(null);
  // Per-tablist button refs so arrow keys move focus inside the visible list.
  const tabRefs = useRef<Record<TablistPrefix, Array<HTMLButtonElement | null>>>({ d: [], m: [] });

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
          <div className="empty">Cargando…</div>
        </div>
      </main>
    );
  }

  if (authed === false) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }

  // Roving arrow keys (A1): Left/Right move focus AND selection, Home/End
  // jump to the ends, within the tablist the user is actually in.
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, prefix: TablistPrefix, index: number): void {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[prefix][next]?.focus();
  }

  function renderTabs(prefix: TablistPrefix): JSX.Element[] {
    return TABS.map((t, i) => (
      <button
        key={t.id}
        id={`${prefix}-${t.id}`}
        role="tab"
        aria-selected={tab === t.id}
        aria-controls={`panel-${t.id}`}
        className={tab === t.id ? 'active' : ''}
        ref={(el) => {
          tabRefs.current[prefix][i] = el;
        }}
        onClick={() => setTab(t.id)}
        onKeyDown={(e) => handleTabKeyDown(e, prefix, i)}
      >
        {t.label}
      </button>
    ));
  }

  return (
    <>
      <header className="app-header">
        <h1>Finanzas Personales</h1>
        <ThemeToggle />
        {/* Desktop tabs; hidden on mobile where the bottom bar takes over. */}
        <nav className="tabs desktop-tabs" role="tablist" aria-label="Secciones">
          {renderTabs('d')}
        </nav>
        <button type="button" className="link muted logout-button" onClick={() => void handleLogout()} data-testid="logout">
          Salir
        </button>
      </header>
      <main>
        <div
          id="panel-transactions"
          role="tabpanel"
          aria-labelledby="d-transactions m-transactions"
          className={tab === 'transactions' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <TransactionsPage active={tab === 'transactions'} />
        </div>
        <div
          id="panel-categories"
          role="tabpanel"
          aria-labelledby="d-categories m-categories"
          className={tab === 'categories' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <CategoriesPage active={tab === 'categories'} />
        </div>
        <div
          id="panel-budgets"
          role="tabpanel"
          aria-labelledby="d-budgets m-budgets"
          className={tab === 'budgets' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <BudgetsPage active={tab === 'budgets'} />
        </div>
        <div
          id="panel-summaries"
          role="tabpanel"
          aria-labelledby="d-summaries m-summaries"
          className={tab === 'summaries' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <SummariesPage active={tab === 'summaries'} />
        </div>
        <div
          id="panel-indicators"
          role="tabpanel"
          aria-labelledby="d-indicators m-indicators"
          className={tab === 'indicators' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <IndicatorsPage active={tab === 'indicators'} />
        </div>
        <div
          id="panel-inversiones"
          role="tabpanel"
          aria-labelledby="d-inversiones m-inversiones"
          className={tab === 'inversiones' ? 'tab-panel' : 'tab-panel hidden'}
        >
          <InvestmentsPage active={tab === 'inversiones'} />
        </div>
      </main>
      {/* Mobile-first navigation: thumb-reachable, same buttons and state as
          the header tabs (CSS swaps them at the ≤640px breakpoint). */}
      <nav className="bottom-bar" role="tablist" aria-label="Secciones">
        {renderTabs('m')}
      </nav>
    </>
  );
}

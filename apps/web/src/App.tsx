import { useEffect, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import LoginGate from './components/LoginGate';
import ThemeToggle from './components/ThemeToggle';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import GoalsPage from './pages/GoalsPage';
import IndicatorsPage from './pages/IndicatorsPage';
import InvestmentsPage from './pages/InvestmentsPage';
import SummariesPage from './pages/SummariesPage';
import TransactionsPage from './pages/TransactionsPage';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries' | 'indicators' | 'inversiones' | 'metas';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transacciones' },
  { id: 'categories', label: 'Categorías' },
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'summaries', label: 'Resúmenes' },
  { id: 'indicators', label: 'Indicadores' },
  { id: 'inversiones', label: 'Inversiones' },
  { id: 'metas', label: 'Metas' },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('transactions');
  // Mobile bottom sheet open state (mobile-only; desktop tabs are unaffected).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
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

  // Mobile sheet: Escape closes, body scroll locks, focus moves into the
  // sheet on open and back to the menu button on close.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    sheetRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  function selectMobileTab(id: Tab): void {
    setTab(id);
    setMenuOpen(false);
  }

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
          <TransactionsPage active={tab === 'transactions'} />
        </div>
        <div className={tab === 'categories' ? 'tab-panel' : 'tab-panel hidden'}>
          <CategoriesPage active={tab === 'categories'} />
        </div>
        <div className={tab === 'budgets' ? 'tab-panel' : 'tab-panel hidden'}>
          <BudgetsPage active={tab === 'budgets'} />
        </div>
        <div className={tab === 'summaries' ? 'tab-panel' : 'tab-panel hidden'}>
          <SummariesPage active={tab === 'summaries'} />
        </div>
        <div className={tab === 'indicators' ? 'tab-panel' : 'tab-panel hidden'}>
          <IndicatorsPage active={tab === 'indicators'} />
        </div>
        <div className={tab === 'inversiones' ? 'tab-panel' : 'tab-panel hidden'}>
          <InvestmentsPage active={tab === 'inversiones'} />
        </div>
        <div className={tab === 'metas' ? 'tab-panel' : 'tab-panel hidden'}>
          <GoalsPage active={tab === 'metas'} />
        </div>
      </main>
      {/* Mobile navigation: a single menu button opens a bottom sheet listing
          the same tabs (CSS swaps the header tabs for this bar at ≤640px). */}
      <nav className="bottom-bar mobile-only" aria-label="Secciones">
        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-sheet"
          aria-haspopup="dialog"
          onClick={() => setMenuOpen((v) => !v)}
          ref={menuButtonRef}
        >
          Menú
        </button>
      </nav>
      {menuOpen && (
        <>
          <div
            className="mobile-nav-backdrop"
            data-testid="mobile-nav-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={sheetRef}
            id="mobile-nav-sheet"
            className="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de secciones"
          >
            <nav className="mobile-nav-list" role="tablist" aria-label="Secciones">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => selectMobileTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { NotificationBell } from '@/features/notifications/NotificationBell';

interface NavItem {
  to: string;
  label: string;
  /** When true, only render for admins. */
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/catalog', label: 'Catálogo' },
  { to: '/dashboard', label: 'Painel' },
  { to: '/rooms', label: 'Salas' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/friends', label: 'Amigos' },
  { to: '/notifications', label: 'Notificações' },
  { to: '/profile', label: 'Perfil' },
  { to: '/notebook', label: 'Caderno' },
  { to: '/settings', label: 'Configurações' },
  { to: '/crud', label: 'CRUD (admin)', adminOnly: true },
];

/**
 * Authenticated app layout: a header with the Athen brand + logout, a sidebar
 * with the primary navigation (crud shown only to admins), and an <Outlet /> for
 * the active page. On small viewports the sidebar collapses into an overlay
 * drawer toggled from the header (pure CSS, see theme.css .app-shell*).
 */
export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sair.');
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="app-shell__menu-toggle"
            aria-label="Abrir menu de navegação"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.25rem',
              height: '2.25rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              color: 'var(--brand-purple)',
              fontSize: '1.1rem',
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          <NavLink to="/dashboard" aria-label="Athen - ir para o painel">
            <BrandMark size={30} />
          </NavLink>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationBell />
          {profile && (
            <span
              style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}
            >
              {profile.display_name || profile.username}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={signingOut}
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="app-shell__body">
        <div
          className={
            navOpen
              ? 'app-shell__backdrop app-shell__backdrop--visible'
              : 'app-shell__backdrop'
          }
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <nav
          aria-label="Navegação principal"
          className={
            navOpen ? 'app-shell__nav app-shell__nav--open' : 'app-shell__nav'
          }
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.92rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--color-text)',
                background: isActive ? 'var(--brand-purple)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { useUnreadCount } from '@/features/notifications/api';
import { formatUnreadBadge } from '@/features/notifications/helpers';
import { useTheme } from './theme';

interface NavItem {
  to: string;
  label: string;
  /** When true, only render for admins. */
  adminOnly?: boolean;
  /** When true, show the unread-notification indicator. */
  showUnread?: boolean;
}

/**
 * Primary navigation, in the EXACT order required by the spec:
 * Painel, Catálogo, Salas, Ranking, Amigos, Cadernos, Notificações,
 * Configurações. The admin-only CRUD link follows Configurações so it never
 * disturbs the required order. Note the label 'Cadernos' (plural) even though
 * the route is /notebook.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Painel' },
  { to: '/catalog', label: 'Catálogo' },
  { to: '/rooms', label: 'Salas' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/friends', label: 'Amigos' },
  { to: '/notebook', label: 'Cadernos' },
  { to: '/notifications', label: 'Notificações', showUnread: true },
  { to: '/settings', label: 'Configurações' },
  { to: '/crud', label: 'CRUD (admin)', adminOnly: true },
];

/**
 * Authenticated app layout: a single persistent left sidebar (brand header,
 * primary navigation with an unread-notification indicator, a light/dark theme
 * toggle, and a profile footer with logout) plus an <Outlet /> for the active
 * page. There is no top bar. On small viewports the sidebar collapses into an
 * overlay drawer toggled from a floating hamburger in the content area.
 */
export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
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

  const profileName = profile?.display_name || profile?.username || 'Perfil';
  const avatarInitial = (profileName.trim()[0] ?? '?').toUpperCase();

  return (
    <div className="app-shell">
      {/* Floating menu toggle (mobile only); replaces the old top bar toggle. */}
      <button
        type="button"
        className="app-shell__menu-toggle"
        aria-label="Abrir menu de navegação"
        aria-expanded={navOpen}
        onClick={() => setNavOpen((open) => !open)}
      >
        ☰
      </button>

      <div
        className={
          navOpen
            ? 'app-shell__backdrop app-shell__backdrop--visible'
            : 'app-shell__backdrop'
        }
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        aria-label="Navegação principal"
        className={
          navOpen
            ? 'app-shell__sidebar app-shell__sidebar--open'
            : 'app-shell__sidebar'
        }
      >
        {/* Brand header -> Painel */}
        <NavLink
          to="/dashboard"
          aria-label="Athen - ir para o painel"
          className="app-shell__brand"
        >
          <BrandMark size={30} />
          <span className="app-shell__brand-name">Athen</span>
        </NavLink>

        {/* Primary navigation */}
        <nav className="app-shell__nav" aria-label="Páginas">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? 'app-shell__nav-item app-shell__nav-item--active'
                  : 'app-shell__nav-item'
              }
            >
              <span>{item.label}</span>
              {item.showUnread && <UnreadIndicator />}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle sits just above the footer */}
        <button
          type="button"
          className="app-shell__theme-toggle"
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={
            theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
          }
          onClick={toggleTheme}
        >
          <span className="app-shell__theme-label">
            {theme === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
          </span>
          <span
            className={
              theme === 'dark'
                ? 'app-shell__switch app-shell__switch--on'
                : 'app-shell__switch'
            }
            aria-hidden="true"
          >
            <span className="app-shell__switch-knob" />
          </span>
        </button>

        {/* Profile footer */}
        <div className="app-shell__footer">
          <NavLink
            to="/profile"
            className="app-shell__profile"
            aria-label={`Perfil de ${profileName}`}
          >
            <span
              className="app-shell__banner"
              style={
                profile?.banner_url
                  ? { backgroundImage: `url(${profile.banner_url})` }
                  : undefined
              }
              aria-hidden="true"
            />
            <span className="app-shell__profile-row">
              <span className="app-shell__avatar" aria-hidden="true">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  avatarInitial
                )}
              </span>
              <span className="app-shell__profile-meta">
                <span className="app-shell__profile-name">{profileName}</span>
                <span className="app-shell__profile-streak">
                  🔥 {profile?.streak_count ?? 0} dias
                </span>
              </span>
            </span>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={signingOut}
          >
            Sair
          </Button>
        </div>
      </aside>

      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Small unread-notification dot/badge for the Notificações nav item. Reuses the
 * polled unread-count hook that previously backed the top-bar bell.
 */
function UnreadIndicator() {
  const { session } = useAuth();
  const { data: count = 0 } = useUnreadCount(session?.user?.id);
  const badge = formatUnreadBadge(count);
  if (!badge) return null;
  return (
    <span
      className="app-shell__unread"
      aria-label={`${count} não lidas`}
      title={`${count} não lidas`}
    >
      {badge}
    </span>
  );
}

export default AppShell;
